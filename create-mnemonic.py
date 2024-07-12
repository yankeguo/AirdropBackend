#!/bin/env python3

from mnemonic import Mnemonic

print(Mnemonic('english').generate(strength=256))