-- Install after quran-demo.sql. Database job, not dependent on an open browser.
begin;
create extension if not exists pg_cron;
select cron.schedule('quran-demo-pupil-expiry','* * * * *','select public.quran_demo_purge();');
commit;
