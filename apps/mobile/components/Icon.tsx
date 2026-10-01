/**
 * Native adapter for the exact Lucide 0.446.0 shapes used by Wardrobe web.
 * Icon geometry is copied from lucide-react@0.446.0; no DOM components are imported.
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */
import React from 'react';
import { type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';

const elements = { circle: Circle, ellipse: Ellipse, line: Line, path: Path, polygon: Polygon, polyline: Polyline, rect: Rect };
type IconNode = readonly [keyof typeof elements, Readonly<Record<string, string | number>>];
const iconNodes = {
  "home": [
    [
      "path",
      {
        "d": "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
        "key": "5wwlr5"
      }
    ],
    [
      "path",
      {
        "d": "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        "key": "1d0kgt"
      }
    ]
  ],
  "shop": [
    [
      "path",
      {
        "d": "m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7",
        "key": "ztvudi"
      }
    ],
    [
      "path",
      {
        "d": "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8",
        "key": "1b2hhj"
      }
    ],
    [
      "path",
      {
        "d": "M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4",
        "key": "2ebpfo"
      }
    ],
    [
      "path",
      {
        "d": "M2 7h20",
        "key": "1fcdvo"
      }
    ],
    [
      "path",
      {
        "d": "M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7",
        "key": "6c3vgh"
      }
    ]
  ],
  "cart": [
    [
      "circle",
      {
        "cx": "8",
        "cy": "21",
        "r": "1",
        "key": "jimo8o"
      }
    ],
    [
      "circle",
      {
        "cx": "19",
        "cy": "21",
        "r": "1",
        "key": "13723u"
      }
    ],
    [
      "path",
      {
        "d": "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",
        "key": "9zh506"
      }
    ]
  ],
  "categories": [
    [
      "rect",
      {
        "width": "7",
        "height": "7",
        "x": "3",
        "y": "3",
        "rx": "1",
        "key": "1g98yp"
      }
    ],
    [
      "rect",
      {
        "width": "7",
        "height": "7",
        "x": "14",
        "y": "3",
        "rx": "1",
        "key": "6d4xhi"
      }
    ],
    [
      "rect",
      {
        "width": "7",
        "height": "7",
        "x": "14",
        "y": "14",
        "rx": "1",
        "key": "nxv5o0"
      }
    ],
    [
      "rect",
      {
        "width": "7",
        "height": "7",
        "x": "3",
        "y": "14",
        "rx": "1",
        "key": "1bb6yr"
      }
    ]
  ],
  "profile": [
    [
      "circle",
      {
        "cx": "12",
        "cy": "8",
        "r": "5",
        "key": "1hypcn"
      }
    ],
    [
      "path",
      {
        "d": "M20 21a8 8 0 0 0-16 0",
        "key": "rfgkzh"
      }
    ]
  ],
  "search": [
    [
      "circle",
      {
        "cx": "11",
        "cy": "11",
        "r": "8",
        "key": "4ej97u"
      }
    ],
    [
      "path",
      {
        "d": "m21 21-4.3-4.3",
        "key": "1qie3q"
      }
    ]
  ],
  "heart": [
    [
      "path",
      {
        "d": "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
        "key": "c3ymky"
      }
    ]
  ],
  "sun": [
    [
      "circle",
      {
        "cx": "12",
        "cy": "12",
        "r": "4",
        "key": "4exip2"
      }
    ],
    [
      "path",
      {
        "d": "M12 2v2",
        "key": "tus03m"
      }
    ],
    [
      "path",
      {
        "d": "M12 20v2",
        "key": "1lh1kg"
      }
    ],
    [
      "path",
      {
        "d": "m4.93 4.93 1.41 1.41",
        "key": "149t6j"
      }
    ],
    [
      "path",
      {
        "d": "m17.66 17.66 1.41 1.41",
        "key": "ptbguv"
      }
    ],
    [
      "path",
      {
        "d": "M2 12h2",
        "key": "1t8f8n"
      }
    ],
    [
      "path",
      {
        "d": "M20 12h2",
        "key": "1q8mjw"
      }
    ],
    [
      "path",
      {
        "d": "m6.34 17.66-1.41 1.41",
        "key": "1m8zz5"
      }
    ],
    [
      "path",
      {
        "d": "m19.07 4.93-1.41 1.41",
        "key": "1shlcs"
      }
    ]
  ],
  "moon": [
    [
      "path",
      {
        "d": "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",
        "key": "a7tn18"
      }
    ]
  ],
  "chevronRight": [
    [
      "path",
      {
        "d": "m9 18 6-6-6-6",
        "key": "mthhwq"
      }
    ]
  ],
  "chevronDown": [
    [
      "path",
      {
        "d": "m6 9 6 6 6-6",
        "key": "qrunsl"
      }
    ]
  ],
  "arrowLeft": [
    [
      "path",
      {
        "d": "m12 19-7-7 7-7",
        "key": "1l729n"
      }
    ],
    [
      "path",
      {
        "d": "M19 12H5",
        "key": "x3x0zl"
      }
    ]
  ],
  "x": [
    [
      "path",
      {
        "d": "M18 6 6 18",
        "key": "1bl5f8"
      }
    ],
    [
      "path",
      {
        "d": "m6 6 12 12",
        "key": "d8bk6v"
      }
    ]
  ],
  "plus": [
    [
      "path",
      {
        "d": "M5 12h14",
        "key": "1ays0h"
      }
    ],
    [
      "path",
      {
        "d": "M12 5v14",
        "key": "s699le"
      }
    ]
  ],
  "minus": [
    [
      "path",
      {
        "d": "M5 12h14",
        "key": "1ays0h"
      }
    ]
  ],
  "trash": [
    [
      "path",
      {
        "d": "M3 6h18",
        "key": "d0wm0j"
      }
    ],
    [
      "path",
      {
        "d": "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",
        "key": "4alrt4"
      }
    ],
    [
      "path",
      {
        "d": "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
        "key": "v07s0e"
      }
    ],
    [
      "line",
      {
        "x1": "10",
        "x2": "10",
        "y1": "11",
        "y2": "17",
        "key": "1uufr5"
      }
    ],
    [
      "line",
      {
        "x1": "14",
        "x2": "14",
        "y1": "11",
        "y2": "17",
        "key": "xtxkd"
      }
    ]
  ],
  "package": [
    [
      "path",
      {
        "d": "m7.5 4.27 9 5.15",
        "key": "1c824w"
      }
    ],
    [
      "path",
      {
        "d": "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
        "key": "hh9hay"
      }
    ],
    [
      "path",
      {
        "d": "m3.3 7 8.7 5 8.7-5",
        "key": "g66t2b"
      }
    ],
    [
      "path",
      {
        "d": "M12 22V12",
        "key": "d0xqtd"
      }
    ]
  ],
  "globe": [
    [
      "circle",
      {
        "cx": "12",
        "cy": "12",
        "r": "10",
        "key": "1mglay"
      }
    ],
    [
      "path",
      {
        "d": "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",
        "key": "13o1zl"
      }
    ],
    [
      "path",
      {
        "d": "M2 12h20",
        "key": "9i4pu4"
      }
    ]
  ],
  "shield": [
    [
      "path",
      {
        "d": "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        "key": "oel41y"
      }
    ],
    [
      "path",
      {
        "d": "m9 12 2 2 4-4",
        "key": "dzmm74"
      }
    ]
  ],
  "logout": [
    [
      "path",
      {
        "d": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
        "key": "1uf3rs"
      }
    ],
    [
      "polyline",
      {
        "points": "16 17 21 12 16 7",
        "key": "1gabdz"
      }
    ],
    [
      "line",
      {
        "x1": "21",
        "x2": "9",
        "y1": "12",
        "y2": "12",
        "key": "1uyos4"
      }
    ]
  ],
  "check": [
    [
      "path",
      {
        "d": "M20 6 9 17l-5-5",
        "key": "1gmf2c"
      }
    ]
  ],
  "filter": [
    [
      "line",
      {
        "x1": "21",
        "x2": "14",
        "y1": "4",
        "y2": "4",
        "key": "obuewd"
      }
    ],
    [
      "line",
      {
        "x1": "10",
        "x2": "3",
        "y1": "4",
        "y2": "4",
        "key": "1q6298"
      }
    ],
    [
      "line",
      {
        "x1": "21",
        "x2": "12",
        "y1": "12",
        "y2": "12",
        "key": "1iu8h1"
      }
    ],
    [
      "line",
      {
        "x1": "8",
        "x2": "3",
        "y1": "12",
        "y2": "12",
        "key": "ntss68"
      }
    ],
    [
      "line",
      {
        "x1": "21",
        "x2": "16",
        "y1": "20",
        "y2": "20",
        "key": "14d8ph"
      }
    ],
    [
      "line",
      {
        "x1": "12",
        "x2": "3",
        "y1": "20",
        "y2": "20",
        "key": "m0wm8r"
      }
    ],
    [
      "line",
      {
        "x1": "14",
        "x2": "14",
        "y1": "2",
        "y2": "6",
        "key": "14e1ph"
      }
    ],
    [
      "line",
      {
        "x1": "8",
        "x2": "8",
        "y1": "10",
        "y2": "14",
        "key": "1i6ji0"
      }
    ],
    [
      "line",
      {
        "x1": "16",
        "x2": "16",
        "y1": "18",
        "y2": "22",
        "key": "1lctlv"
      }
    ]
  ],
  "star": [
    [
      "polygon",
      {
        "points": "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2",
        "key": "8f66p6"
      }
    ]
  ],
  "alert": [
    [
      "circle",
      {
        "cx": "12",
        "cy": "12",
        "r": "10",
        "key": "1mglay"
      }
    ],
    [
      "line",
      {
        "x1": "12",
        "x2": "12",
        "y1": "8",
        "y2": "12",
        "key": "1pkeuh"
      }
    ],
    [
      "line",
      {
        "x1": "12",
        "x2": "12.01",
        "y1": "16",
        "y2": "16",
        "key": "4dfq90"
      }
    ]
  ],
  "bag": [
    [
      "path",
      {
        "d": "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z",
        "key": "hou9p0"
      }
    ],
    [
      "path",
      {
        "d": "M3 6h18",
        "key": "d0wm0j"
      }
    ],
    [
      "path",
      {
        "d": "M16 10a4 4 0 0 1-8 0",
        "key": "1ltviw"
      }
    ]
  ],
  "truck": [
    [
      "path",
      {
        "d": "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",
        "key": "wrbu53"
      }
    ],
    [
      "path",
      {
        "d": "M15 18H9",
        "key": "1lyqi6"
      }
    ],
    [
      "path",
      {
        "d": "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",
        "key": "lysw3i"
      }
    ],
    [
      "circle",
      {
        "cx": "17",
        "cy": "18",
        "r": "2",
        "key": "332jqn"
      }
    ],
    [
      "circle",
      {
        "cx": "7",
        "cy": "18",
        "r": "2",
        "key": "19iecd"
      }
    ]
  ],
  "pencil": [
    [
      "path",
      {
        "d": "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
        "key": "1a8usu"
      }
    ],
    [
      "path",
      {
        "d": "m15 5 4 4",
        "key": "1mk7zo"
      }
    ]
  ],
  "lock": [
    [
      "rect",
      {
        "width": "18",
        "height": "11",
        "x": "3",
        "y": "11",
        "rx": "2",
        "ry": "2",
        "key": "1w4ew1"
      }
    ],
    [
      "path",
      {
        "d": "M7 11V7a5 5 0 0 1 10 0v4",
        "key": "fwvmzm"
      }
    ]
  ]
} as const satisfies Record<string, readonly IconNode[]>;

export type IconName = keyof typeof iconNodes;
export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
  fill?: ColorValue;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Icon({ name, size = 20, color, strokeWidth = 1.75, fill, filled = false, style }: IconProps) {
  const { colors } = useTheme();
  const stroke = color ?? colors.text;
  return <Svg width={size} height={size} viewBox="0 0 24 24"
    fill={fill ?? (filled ? stroke : 'none')} stroke={stroke} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" style={style}
    accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {iconNodes[name].map(([tag, attributes], index) => React.createElement(elements[tag] as React.ElementType,
      { ...attributes, key: attributes.key ?? index }))}
  </Svg>;
}

export default Icon;
