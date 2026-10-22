"""Give an account a role, and/or change its display name or username. Idempotent.

    cd backend
    uv run python scripts/set_role.py --username <old-username> --role admin --display Farah
    uv run python scripts/set_role.py --username <old-username> --new-username <new-username>

Run it from the backend/ directory so backend/.env is found. The username (what the person types
to sign in) changes only when you pass --new-username; the old one then stops working.
Apply migrations/0003_user_roles.sql first, or the database will say there is no `role` column.
"""

import argparse
import sys

from postgrest import APIError

from app.core.settings import MissingSettingsError, load_settings
from app.db.client import build_client
from app.db.users import ROLES, UsernameTakenError, update_user


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--username", required=True)
    parser.add_argument("--role", choices=sorted(ROLES), default=None)
    parser.add_argument("--display", default=None, help="New display name shown in the app")
    parser.add_argument(
        "--new-username",
        default=None,
        help="New username to sign in with (the old one stops working)",
    )
    args = parser.parse_args()
    try:
        settings = load_settings()
    except MissingSettingsError as err:
        print(err, file=sys.stderr)
        return 2
    try:
        user = update_user(
            build_client(settings),
            args.username,
            role=args.role,
            display_name=args.display,
            new_username=args.new_username,
        )
    except ValueError as err:
        print(f"Invalid input: {err}", file=sys.stderr)
        return 2
    except UsernameTakenError:
        print(f"The username {args.new_username!r} is already taken.", file=sys.stderr)
        return 1
    except APIError as err:
        hint = (
            " (apply migrations/0003_user_roles.sql first)" if "role" in (err.message or "") else ""
        )
        print(f"Database error ({err.code}): {err.message or ''}{hint}", file=sys.stderr)
        return 1
    if user is None:
        print(f"No user called {args.username!r}.", file=sys.stderr)
        return 1
    role = user.get("role", "user")
    print(f"Updated: {user['username']} (role {role}, name {user['display_name']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
