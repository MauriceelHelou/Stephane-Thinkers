"""
Custom database column types for cross-database compatibility
"""
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid


class GUID(TypeDecorator):
    """
    Platform-independent GUID type.

    Uses PostgreSQL's UUID type when available,
    otherwise uses CHAR(32), storing as stringified hex values.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return value.replace('-', '')  # Already a string
            else:
                # Ensure that UUID identifier is without dashes
                return value.hex

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if isinstance(value, uuid.UUID):
                return value
            elif isinstance(value, str):
                # Convert string to UUID
                if len(value) == 32:
                    # No hyphens, add them back
                    value = f'{value[0:8]}-{value[8:12]}-{value[12:16]}-{value[16:20]}-{value[20:32]}'
                return uuid.UUID(value)
            elif isinstance(value, bytes):
                # Handle bytes (sometimes returned by databases)
                return uuid.UUID(bytes=value)
            else:
                # For any other type, try to convert to string first
                try:
                    return uuid.UUID(str(value))
                except (ValueError, AttributeError):
                    # If conversion fails, return as-is (shouldn't happen)
                    return value
