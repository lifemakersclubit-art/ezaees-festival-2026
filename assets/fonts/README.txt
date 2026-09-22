assets/fonts/
=============

Optional local fonts used by the dashboard:

- Arslan.ttf        -> decorative/art display faces (section kickers)
- ArslanBold.ttf    -> bold variant

The @font-face rules live inside index.html and registrations.html:

    @font-face {
      font-family: 'Arslan';
      src: url('assets/fonts/Arslan.ttf') format('truetype');
    }

If you do not have the font files, everything still renders correctly:
"Arslan" falls back to Alexandria automatically. Alexandria is loaded
from Google Fonts at runtime.

Place files here:
  Arslan.ttf
  ArslanBold.ttf