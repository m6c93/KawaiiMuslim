import { createClient } from 'npm:@supabase/supabase-js@2';
import { immediateDeletionAvailable } from './release.mjs';
import Stripe from 'npm:stripe@22.5.0';
import { corsHeaders as sharedCorsHeaders, jsonResponse } from '../_shared/cors.ts';
import { deleteFamilyAccount, DeletionError, requireMFA } from './core.mjs';

const corsHeaders = { ...sharedCorsHeaders, "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

const checked = (result: any) => {
  if (result.error) throw new Error('Service unavailable');
  return result.data;
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST'].includes(request.method)) return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
  try {
    const authorization = request.headers.get('Authorization') || '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const sessionClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Authenticate the capability query too. Do not instantiate Stripe, read a
    // password or invoke the destructive core while the release gate is closed.
    const { data: current, error: currentError } = await sessionClient.auth.getUser();
    if (currentError || !current.user) return jsonResponse({ error: 'Connexion requise.' }, 401);
    if (request.method === 'GET') return jsonResponse({ immediateDeletion: immediateDeletionAvailable() });
    if (!immediateDeletionAvailable()) return jsonResponse({
      error: 'La suppression immédiate n’est pas disponible. Utilise la demande de suppression dans Mon compte ; les demandes déjà enregistrées conservent leur échéance.',
      code: 'IMMEDIATE_DELETION_NOT_RELEASED',
    }, 409);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await deleteFamilyAccount(await request.json(), {
      authenticate: async () => {
        const result = await sessionClient.auth.getUser();
        if (result.error) throw new DeletionError('Reconnecte-toi pour supprimer ton compte.', 401);
        const user = result.data.user;
        if (user?.factors?.some(factor => factor.status === 'verified')) {
          const claims = checked(await sessionClient.auth.getClaims(authorization.replace(/^Bearer\s+/i, '')));
          requireMFA(user, claims?.claims?.aal);
        }
        return user;
      },
      verifyPassword: async (user: any, password: string) => {
        const verification = createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const signed = await verification.auth.signInWithPassword({ email: user.email, password });
        if (signed.error || signed.data.user?.id !== user.id) {
          throw new DeletionError('Mot de passe incorrect. Aucune donnée supprimée.', 401);
        }
        await verification.auth.signOut({ scope: 'local' });
      },
      profile: async (id: string) => checked(await admin.from('profiles').select('role').eq('id', id).single()),
      hasProfessionalData: async (id: string) => {
        for (const [table, column] of [
          ['quran_organization_members', 'profile_id'], ['quran_platform_students', 'profile_id'],
          ['quran_direct_messages', 'sender_id'], ['quran_audit', 'actor_id'],
          ['quran_class_attendance', 'updated_by'], ['quran_organizations', 'created_by'],
          ['quran_platform_classes', 'teacher_id'], ['quran_access_invitations', 'created_by'],
        ]) {
          const rows = checked(await admin.from(table).select(column).eq(column, id).limit(1));
          if (rows.length) return true;
        }
        return false;
      },
      existingRequest: async (id: string) => checked(await admin.from('account_deletion_requests')
        .select('id,status,requested_at,due_at').eq('user_id', id).maybeSingle()),
      billing: async (id: string) => checked(await admin.from('subscriptions')
        .select('stripe_customer_id,stripe_subscription_id,status').eq('user_id', id).maybeSingle()),
      files: async (id: string) => {
        const files: string[] = [];
        const walk = async (prefix: string) => {
          for (let offset = 0; ; offset += 100) {
            const objects = checked(await admin.storage.from('child-artworks').list(prefix, {
              limit: 100, offset, sortBy: { column: 'name', order: 'asc' },
            }));
            for (const object of objects) {
              const path = `${prefix}/${object.name}`;
              if (object.id) files.push(path); else await walk(path);
            }
            if (objects.length < 100) break;
          }
        };
        await walk(id);
        return files;
      },
      cancelSubscriptions: async (billing: any) => {
        if (!billing?.stripe_customer_id) {
          if (billing && !['canceled', 'incomplete_expired'].includes(billing.status)) {
            throw new DeletionError('Ton abonnement nécessite une vérification par l’assistance avant suppression.', 409);
          }
          return;
        }
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2026-06-24.dahlia' });
        const subscriptions = stripe.subscriptions.list({ customer: billing.stripe_customer_id, status: 'all', limit: 100 });
        for await (const subscription of subscriptions) {
          if (!['canceled', 'incomplete_expired'].includes(subscription.status)) {
            await stripe.subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false });
          }
        }
      },
      removeFiles: async (files: string[]) => {
        for (let i = 0; i < files.length; i += 100) {
          checked(await admin.storage.from('child-artworks').remove(files.slice(i, i + 100)));
        }
      },
      deleteUser: async (id: string) => checked(await admin.auth.admin.deleteUser(id, false)),
    });
    return jsonResponse(result);
  } catch (error) {
    // Never log request bodies, passwords, bearer tokens or personal data.
    if (error instanceof DeletionError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: 'La suppression n’a pas pu être terminée. Réessaie ou contacte l’assistance. Ne considère pas ton compte comme supprimé sans confirmation.' }, 503);
  }
});
