"""Seed a tester account. Idempotent.

    cd backend && uv run python scripts/seed_users.py --username amir --display "Amir" \
        --persona frequent_bnpl

Run it from the backend/ directory so backend/.env is found.
"""

import argparse
import sys

from postgrest import APIError

from app.core.settings import MissingSettingsError, load_settings
from app.db.client import build_client
from app.db.users import PERSONAS, ROLES, role_of
from app.seed import seed_user


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--username", required=True)
    parser.add_argument("--display", required=True, help="Display name shown in the app")
    parser.add_argument("--persona", choices=sorted(PERSONAS), default=None)
    parser.add_argument("--role", choices=sorted(ROLES), default="user")
    args = parser.parse_args()
    try:
        settings = load_settings()
    except MissingSettingsError as err:
        print(err, file=sys.stderr)
        return 2
    try:
        user, created = seed_user(
            build_client(settings),
            username=args.username,
            display_name=args.display,
            persona=args.persona,
            role=args.role,
        )
    except ValueError as err:
        print(f"Invalid input: {err}", file=sys.stderr)
        return 2
    except APIError as err:
        print(f"Database error ({err.code}): {err.message}", file=sys.stderr)
        return 1
    print(f"{'Created' if created else 'Already exists'}: {user['username']} ({user['id']})")
    if not created and args.role != role_of(user):
        print(
            f"Role not changed (it is {role_of(user)}): use scripts/set_role.py to change an "
            "existing account.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
