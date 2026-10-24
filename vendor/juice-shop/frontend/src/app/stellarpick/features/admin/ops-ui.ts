/** 平台后台的共享运营样式：更密的表格、筛选 chips、状态步进、活动流。 */
export const OPS_CSS = `
  .ops-page { display: flex; flex-direction: column; gap: 16px; }
  .ops-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .ops-head h2 { font-size: 24px; letter-spacing: -0.015em; }
  .ops-eyebrow { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--sp-text-muted); }
  .ops-sub { margin-top: 4px; font-size: 13px; color: var(--sp-text-secondary); }
  .ops-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ops-actions .sp-btn { min-height: 40px; }
  .ops-meta { display: flex; align-items: center; gap: 6px 14px; flex-wrap: wrap; margin-top: 6px; font-size: 12px; color: var(--sp-text-muted); }
  .ops-meta b { color: var(--sp-text); font-weight: 600; }

  .ops-card { background: var(--sp-surface); border: 1px solid var(--sp-border); border-radius: 10px; box-shadow: var(--sp-shadow-sm); overflow: hidden; }
  .ops-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--sp-border); }
  .ops-card-head h3 { font-size: 15px; letter-spacing: -0.01em; }
  .ops-card-head p { margin-top: 2px; font-size: 12px; color: var(--sp-text-muted); }
  .ops-card-body { padding: 16px 18px; }
  .ops-count { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; background: var(--sp-bg); font-size: 11px; font-weight: 700; color: var(--sp-text-secondary); white-space: nowrap; }

  .ops-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-bottom: 1px solid var(--sp-border); background: #FDFCFA; }
  .ops-search { position: relative; display: flex; align-items: center; flex: 1 1 220px; max-width: 340px; }
  .ops-search app-admin-icon { position: absolute; left: 12px; color: var(--sp-text-muted); pointer-events: none; }
  .ops-search .sp-input { padding-left: 34px; min-height: 40px; background: var(--sp-surface); }
  .ops-toolbar .sp-select { min-height: 40px; width: auto; min-width: 112px; }
  .ops-toolbar .sp-btn { min-height: 40px; }
  .ops-toolbar-end { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  .ops-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 8px 14px; border-bottom: 1px solid var(--sp-border); background: #FDFCFA; }
  .ops-chip { display: inline-flex; align-items: center; gap: 4px; min-height: 30px; padding: 2px 3px 2px 10px; border: 1px solid var(--sp-border-strong); border-radius: 999px; background: var(--sp-surface); font-size: 12px; color: var(--sp-text-secondary); }
  .ops-chip strong { color: var(--sp-text); font-weight: 600; }
  .ops-chip button { width: 26px; height: 26px; border: 0; border-radius: 999px; background: transparent; color: var(--sp-text-muted); display: inline-flex; align-items: center; justify-content: center; }
  .ops-chip button:hover { background: var(--sp-bg); color: var(--sp-text); }
  .ops-chip--view { padding-left: 4px; border-style: dashed; }
  .ops-chip--view button { width: auto; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--sp-primary); }
  .ops-chip--view button:hover { background: var(--sp-info-soft); }
  .ops-chip-add { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 10px; border: 1px dashed var(--sp-border-strong); border-radius: 999px; background: transparent; font-size: 12px; font-weight: 600; color: var(--sp-text-secondary); }
  .ops-chip-add:hover { border-color: var(--sp-primary); color: var(--sp-primary); }

  .ops-bulk { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; background: #FDF6E8; border-bottom: 1px solid #F0DDBB; font-size: 13px; color: var(--sp-text-secondary); }
  .ops-bulk strong { color: var(--sp-text); }
  .ops-bulk .ops-toolbar-end { margin-left: auto; }

  .ops-table-wrap { width: 100%; overflow: auto; max-height: 720px; }
  .ops-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ops-table caption { caption-side: top; text-align: left; padding: 10px 14px; font-size: 12px; color: var(--sp-text-muted); border-bottom: 1px solid var(--sp-border); }
  .ops-table th { position: sticky; top: 0; z-index: 2; background: #FAF7F2; color: var(--sp-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .02em; text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--sp-border-strong); white-space: nowrap; }
  .ops-table td { padding: 8px 14px; border-bottom: 1px solid var(--sp-border); vertical-align: middle; }
  .ops-table tbody tr { height: 56px; }
  .ops-table tbody tr:hover { background: #FBF8F3; }
  .ops-table tbody tr.is-selected { background: #FDF6E8; }
  .ops-table tbody tr:last-child td { border-bottom: 0; }
  .ops-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .ops-table .actions { text-align: right; white-space: nowrap; }
  .ops-table .sel { width: 48px; padding-right: 0; }
  .ops-table .muted { color: var(--sp-text-muted); }
  .ops-table .sub { display: block; margin-top: 1px; font-size: 11px; color: var(--sp-text-muted); }
  .ops-check-hit { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; margin: -8px 0 -8px -8px; cursor: pointer; }
  .ops-check { width: 17px; height: 17px; accent-color: var(--sp-primary); cursor: pointer; }
  .ops-row-actions { display: inline-flex; align-items: center; gap: 2px; }
  .ops-row-actions .sp-btn { min-height: 36px; padding: 0 10px; }
  .ops-avatar { width: 30px; height: 30px; border-radius: 999px; background: var(--sp-info-soft); color: var(--sp-info-strong); display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex: none; }
  .ops-thumb { width: 36px; height: 36px; border-radius: 6px; border: 1px solid var(--sp-border); background: var(--sp-bg); object-fit: cover; flex: none; }
  .ops-cell-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .ops-cell-text { display: flex; flex-direction: column; min-width: 0; }
  .ops-cell-text strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ops-cell-text small { font-size: 11px; color: var(--sp-text-muted); margin-top: 1px; }
  .ops-scroll-hint { display: none; text-align: center; margin: -4px 0 0; font-size: 12px; color: var(--sp-text-muted); }

  .ops-feed { display: flex; flex-direction: column; }
  .ops-feed li { display: flex; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--sp-border); }
  .ops-feed li:last-child { border-bottom: 0; }
  .ops-feed .feed-ico { width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--sp-info-soft); color: var(--sp-info-strong); }
  .ops-feed .feed-ico--accent { background: #FBF0DC; color: var(--sp-accent-text); }
  .ops-feed .feed-ico--warning { background: var(--sp-warning-soft); color: var(--sp-warning); }
  .ops-feed .feed-ico--success { background: var(--sp-success-soft); color: var(--sp-success); }
  .ops-feed .feed-ico--muted { background: var(--sp-bg); color: var(--sp-text-muted); }
  .ops-feed .feed-body { flex: 1 1 auto; min-width: 0; }
  .ops-feed .feed-body strong { font-size: 13px; }
  .ops-feed .feed-body p { font-size: 12px; color: var(--sp-text-secondary); margin-top: 1px; }
  .ops-feed .feed-side { text-align: right; white-space: nowrap; font-size: 11px; color: var(--sp-text-muted); }
  .ops-feed .feed-side b { display: block; font-size: 13px; color: var(--sp-text); font-variant-numeric: tabular-nums; }

  .ops-stepper { display: flex; align-items: flex-start; margin: 0; padding: 0; list-style: none; }
  .ops-stepper li { position: relative; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .ops-stepper .dot { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--sp-border-strong); background: var(--sp-surface); color: var(--sp-text-muted); display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
  .ops-stepper li.done .dot { background: var(--sp-primary); border-color: var(--sp-primary); color: #fff; }
  .ops-stepper li.active .dot { background: var(--sp-accent); border-color: var(--sp-accent); color: var(--sp-primary); }
  .ops-stepper li::after { content: ''; position: absolute; top: 11px; left: 22px; right: 6px; height: 1px; background: var(--sp-border); }
  .ops-stepper li:last-child::after { display: none; }
  .ops-stepper li.done::after { background: var(--sp-primary); }
  .ops-stepper .label { font-size: 12px; color: var(--sp-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ops-stepper .label strong { display: block; font-size: 12px; color: var(--sp-text); font-weight: 600; }
  .ops-stepper .time { font-size: 11px; color: var(--sp-text-muted); }
  .ops-stepper--mini { display: inline-flex; align-items: center; gap: 3px; vertical-align: middle; }
  .ops-stepper--mini span { width: 7px; height: 7px; border-radius: 50%; background: var(--sp-border-strong); }
  .ops-stepper--mini span.done { background: var(--sp-primary); }
  .ops-stepper--mini span.active { background: var(--sp-accent); }
  .ops-stepper--mini span.cancel { background: var(--sp-danger); }

  .ops-timeline { margin: 0; padding: 2px 0 0 2px; list-style: none; }
  .ops-timeline li { position: relative; padding: 0 0 16px 22px; }
  .ops-timeline li:last-child { padding-bottom: 0; }
  .ops-timeline li::before { content: ''; position: absolute; left: 3px; top: 5px; width: 7px; height: 7px; border-radius: 50%; background: var(--sp-border-strong); }
  .ops-timeline li::after { content: ''; position: absolute; left: 6px; top: 14px; bottom: 0; width: 1px; background: var(--sp-border); }
  .ops-timeline li:last-child::after { display: none; }
  .ops-timeline li.done::before { background: var(--sp-primary); }
  .ops-timeline li.active::before { background: var(--sp-accent); box-shadow: 0 0 0 3px rgba(232, 163, 61, .18); }
  .ops-timeline li.cancel::before { background: var(--sp-danger); }
  .ops-timeline li.cancel .tl-title { color: var(--sp-danger); }
  .ops-timeline .tl-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
  .ops-timeline .tl-meta { font-size: 12px; color: var(--sp-text-muted); margin-top: 1px; }

  .ops-drawer { display: flex; flex-direction: column; gap: 18px; }
  .ops-drawer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .ops-drawer-head h3 { font-size: 20px; margin-top: 2px; letter-spacing: -0.01em; }
  .ops-section { display: flex; flex-direction: column; gap: 10px; }
  .ops-section > h3, .ops-section > h4 { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 700; letter-spacing: .02em; color: var(--sp-text); }
  .ops-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin: 0; }
  .ops-meta-grid div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .ops-meta-grid dt { font-size: 11px; color: var(--sp-text-muted); }
  .ops-meta-grid dd { margin: 0; font-size: 13px; color: var(--sp-text); overflow-wrap: anywhere; }
  .ops-hr { height: 1px; background: var(--sp-border); border: 0; margin: 0; }

  .ops-empty-line { display: flex; align-items: center; gap: 8px; padding: 18px; font-size: 13px; color: var(--sp-text-secondary); }
  .ops-skeleton-row { height: 56px; margin: 8px 14px; border-radius: 6px; }

  @media (max-width: 1199px) {
    .ops-toolbar .ops-toolbar-end { margin-left: 0; }
  }
  @media (max-width: 767px) {
    .ops-head h2 { font-size: 20px; }
    .ops-actions { width: 100%; }
    .ops-actions .sp-btn { flex: 1 1 auto; }
    .ops-toolbar { padding: 10px 12px; gap: 8px; }
    .ops-search { max-width: none; flex-basis: 100%; }
    .ops-toolbar .sp-select { flex: 1 1 42%; min-width: 0; }
    .ops-toolbar-end { width: 100%; justify-content: space-between; }
    .ops-toolbar-end .ops-count { margin-right: auto; }
    .ops-chips { padding: 8px 12px; }
    .ops-table-wrap { max-height: none; }
    .ops-scroll-hint { display: block; }
    .ops-meta-grid { grid-template-columns: 1fr; }
    .ops-feed li { padding: 12px 14px; }
    .ops-table td, .ops-table th { padding-left: 12px; padding-right: 12px; }
  }
`;