#!/usr/bin/env python3
"""Replace Capacitor's default launcher icons with the atom mark.

Legacy icons (ic_launcher / ic_launcher_round) carry their own background.
The adaptive foreground does not: Android composites it over the colour in
values/ic_launcher_background.xml, and crops the outer third, so the atom is
drawn small and centred on a transparent canvas.
"""

import os
import sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib.machinery import SourceFileLoader

mk = SourceFileLoader('mk', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'make-icons.py'))
# make-icons.py writes files on import, so its drawing helper is re-implemented
# here rather than imported. Keep the two in step if the mark changes.

RES = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'android', 'app', 'src', 'main', 'res')
DENSITIES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
FOREGROUND = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
