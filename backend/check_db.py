from sqlalchemy import text


def main():
    try:
        from database import engine

        try:
            with engine.connect() as connection:
                result = connection.execute(
                    text("SELECT 1")
                ).scalar_one()

                if result != 1:
                    raise RuntimeError("Unexpected database response.")
        finally:
            engine.dispose()

    except Exception as error:
        # Avoid printing connection credentials in error output.
        print(
            "Database connection failed "
            f"({type(error).__name__})."
        )
        print(
            "Check your backend/.env, internet connection, "
            "and Neon connection settings."
        )
        raise SystemExit(1)

    print("Success: GodEye backend connected to Neon PostgreSQL.")


if __name__ == "__main__":
    main()