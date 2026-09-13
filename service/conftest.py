"""Put the service folder on the import path for the test suite.

`main.py` imports its siblings flatly (`from models import ...`) because uvicorn
is run from this directory. Tests live a level down in tests/, so without this
they would not find those modules.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa


@pytest.fixture()
def keypair():
    """A throwaway RSA keypair standing in for Clerk's.

    Nothing here is a real Clerk credential — it exists so test_auth.py can
    exercise get_current_user_id's real RS256 verification without a live
    JWKS endpoint.
    """
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)
