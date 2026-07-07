import psycopg2

PASSWORD = "Smartan2026Varsity"
PROJECT_REF = "jdpavlmxhabttkkbxbzg"
DBNAME = "postgres"

# The project is in AWS Ireland region (eu-west-1)
configs = [
    {"host": "aws-0-eu-west-1.pooler.supabase.com",          "port": 5432, "user": f"postgres.{PROJECT_REF}",       "label": "Pooler session EU-West-1 (Ireland) :5432"},
    {"host": "aws-0-eu-west-1.pooler.supabase.com",          "port": 6543, "user": f"postgres.{PROJECT_REF}",       "label": "Pooler transaction EU-West-1 (Ireland) :6543"},
]

working = None
for cfg in configs:
    label = cfg.pop("label")
    try:
        print(f"Trying {label} ...", end=" ", flush=True)
        conn = psycopg2.connect(**cfg, password=PASSWORD, dbname=DBNAME,
                                connect_timeout=15, sslmode="require")
        cur = conn.cursor()
        cur.execute("SELECT version()")
        v = cur.fetchone()[0]
        print(f"SUCCESS!")
        print(f"  PostgreSQL: {v[:70]}")
        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
        tables = [r[0] for r in cur.fetchall()]
        print(f"  Tables ({len(tables)}): {tables if tables else 'NONE — run supabase_schema.sql'}")
        conn.close()
        working = {"host": cfg["host"], "port": cfg["port"], "user": cfg["user"], "label": label}
        break
    except Exception as e:
        print(f"FAIL: {str(e)[:150]}")

if working:
    print(f"\n=== WORKING CONNECTION ===")
    print(f"  host : {working['host']}")
    print(f"  port : {working['port']}")
    print(f"  user : {working['user']}")
else:
    print("\nAll configs failed. Check Supabase dashboard.")
