Self-hosted variable fonts (design handoff §Assets requires no third-party
request from the Worker). Both files are the Google Fonts **latin** subsets and
are VARIABLE — one file covers every weight the design uses, so @font-face
declares a weight *range*:

    @font-face {
      font-family: 'Familjen Grotesk';
      src: url('/fonts/FamiljenGrotesk-var.woff2') format('woff2-variations');
      font-weight: 400 700;   /* variable range, not a single weight */
      font-display: swap;
    }
    @font-face {
      font-family: 'Figtree';
      src: url('/fonts/Figtree-var.woff2') format('woff2-variations');
      font-weight: 400 800;
      font-display: swap;
    }

Both are SIL Open Font License 1.1. Serve with a long-lived immutable cache header.
