import { StyleSheet } from '@react-pdf/renderer'

// ── Brand tokens — verde musgo/militar + creme ────────────────────────────────
export const COLORS = {
  // Olive / military greens
  blue950:  '#2e3d15',   // olive-900  — cover page & card header background
  blue900:  '#3b4f1c',   // olive-800  — accent bar / rule lines
  blue700:  '#4d6624',   // olive-700  — section dividers & title color
  // Creams / beiges
  gray50:   '#faf8f0',   // cream-50   — card body background
  gray100:  '#f0ece0',   // cream-100  — separator
  gray300:  '#c8c2ac',   // cream-300  — muted text
  gray400:  '#a09884',   // cream-400  — secondary labels
  gray500:  '#7a7060',   // cream-500  — body text mid
  gray700:  '#4a4438',   // cream-700  — body text
  gray900:  '#2a261e',   // cream-900  — headings
  white:    '#ffffff',
  emerald:  '#10b981',
  amber:    '#84a83a',   // replaced with olive accent for badges
  red:      '#ef4444',
  // Extras for cover page subtle tones
  oliveLight:  '#c2d894',  // olive-200 — subtitle text on dark header
}

// ── Base stylesheet ───────────────────────────────────────────────────────────
export const styles = StyleSheet.create({

  // Page
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: COLORS.white,
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 9,
    color: COLORS.gray900,
  },

  // ── Page header (repeated) ────────────────────────────────────────────────
  pageHeader: {
    position: 'absolute',
    top: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    paddingBottom: 8,
  },
  pageHeaderBrand: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.blue900,
    letterSpacing: 1,
  },
  pageHeaderClient: {
    fontSize: 8,
    color: COLORS.gray400,
  },
  pageHeaderPage: {
    fontSize: 8,
    color: COLORS.gray400,
  },

  // ── Page footer ───────────────────────────────────────────────────────────
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
    paddingTop: 8,
  },
  pageFooterText: {
    fontSize: 7,
    color: COLORS.gray300,
  },

  // ── Cover page ────────────────────────────────────────────────────────────
  coverPage: {
    backgroundColor: COLORS.blue950,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  coverAccent: {
    backgroundColor: COLORS.blue900,
    height: 6,
  },
  coverContent: {
    paddingHorizontal: 56,
    paddingTop: 80,
    paddingBottom: 60,
    flex: 1,
    justifyContent: 'space-between',
  },
  coverLabel: {
    fontSize: 8,
    color: '#c2d894',     // olive-200 — light label on dark bg
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
    lineHeight: 1.2,
    marginBottom: 8,
  },
  coverCpf: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#c2d894',
    letterSpacing: 1,
  },
  coverMeta: {
    marginTop: 40,
  },
  coverMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
  },
  coverMetaLabel: {
    fontSize: 7,
    color: '#c2d894',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  coverMetaValue: {
    fontSize: 8,
    color: COLORS.white,
    fontFamily: 'Helvetica-Bold',
  },

  // ── Section title (top of each section page) ──────────────────────────────
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.blue950,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 9,
    color: COLORS.gray400,
    marginBottom: 20,
  },
  sectionDivider: {
    height: 3,
    backgroundColor: COLORS.blue900,
    marginBottom: 20,
    borderRadius: 2,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    marginBottom: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: COLORS.blue950,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
  },
  cardHeaderSubtitle: {
    fontSize: 8,
    color: '#c2d894',
    marginTop: 2,
  },
  cardHeaderValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
    textAlign: 'right',
  },
  cardHeaderValueLabel: {
    fontSize: 7,
    color: '#c2d894',
    textAlign: 'right',
  },
  cardBody: {
    backgroundColor: COLORS.gray50,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // ── Badge ─────────────────────────────────────────────────────────────────
  badge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },

  // ── Field row ─────────────────────────────────────────────────────────────
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 12,
  },
  fieldGroup: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 7,
    color: COLORS.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 9,
    color: COLORS.gray700,
  },
  fieldValueMono: {
    fontSize: 9,
    color: COLORS.gray700,
    fontFamily: 'Courier',
  },

  // ── Summary strip (patrimônio total) ──────────────────────────────────────
  summaryStrip: {
    backgroundColor: COLORS.blue950,
    borderRadius: 6,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 7,
    color: '#c2d894',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
  },

  // ── Text utilities ────────────────────────────────────────────────────────
  bodyText: {
    fontSize: 9,
    color: COLORS.gray700,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 9,
    color: COLORS.gray300,
    textAlign: 'center',
    paddingVertical: 12,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.gray100,
    marginVertical: 8,
  },
})
