"""Put the service folder on the import path for the test suite.

`main.py` imports its siblings flatly (`from models import ...`) because uvicorn
is run from this directory. Tests live a level down in tests/, so without this
they would not find those modules.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
