from odoo import fields, models, tools, api
from dateutil.relativedelta import relativedelta


class ArDashboardReport(models.Model):
    """Read-only SQL view: one row per Sale Order <-> Customer Invoice pair.

    Orders with no invoice yet still appear (invoice_id is NULL) so
    'To Invoice' orders are visible on the dashboard.
    """
    _name = 'ar.dashboard.report'
    _description = 'AR Dashboard Report'
    _auto = False
    _order = 'order_date desc'
    _rec_name = 'order_ref'

    order_id = fields.Many2one('sale.order', string='Order', readonly=True)
    order_ref = fields.Char(string='Order Ref', readonly=True)
    order_date = fields.Date(string='Order Date', readonly=True)
    order_invoice_status = fields.Selection(
        [
            ('upselling', 'Upselling Opportunity'),
            ('invoiced', 'Fully Invoiced'),
            ('to invoice', 'To Invoice'),
            ('no', 'Nothing to Invoice'),
        ],
        string='Order Invoice Status', readonly=True,
    )
    order_amount_total = fields.Monetary(string='Order Total', readonly=True)

    partner_id = fields.Many2one('res.partner', string='Customer', readonly=True)
    salesperson_id = fields.Many2one('res.users', string='Salesperson', readonly=True)
    company_id = fields.Many2one('res.company', string='Company', readonly=True)
    currency_id = fields.Many2one('res.currency', string='Currency', readonly=True)

    invoice_id = fields.Many2one('account.move', string='Invoice', readonly=True)
    invoice_ref = fields.Char(string='Invoice Ref', readonly=True)
    invoice_date = fields.Date(string='Invoice Date', readonly=True)
    payment_state = fields.Selection(
        [
            ('not_paid', 'Not Paid'),
            ('in_payment', 'In Payment'),
            ('paid', 'Paid'),
            ('partial', 'Partially Paid'),
            ('reversed', 'Reversed'),
            ('invoicing_legacy', 'Invoicing App Legacy'),
        ],
        string='Payment Status', readonly=True,
    )
    invoice_amount_total = fields.Monetary(string='Invoice Total', readonly=True)
    invoice_amount_residual = fields.Monetary(string='Amount Due', readonly=True)

    order_bucket = fields.Selection(
        [
            ('to_invoice', 'To Invoice'),
            ('paid', 'Paid'),
            ('partially_paid', 'Partially Paid'),
            ('unpaid', 'Unpaid'),
        ],
        string='AR Bucket', readonly=True,
    )

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT
                    ROW_NUMBER() OVER (ORDER BY so.id, am.id) AS id,

                    so.id AS order_id,
                    so.name AS order_ref,
                    so.date_order::date AS order_date,
                    so.invoice_status AS order_invoice_status,
                    so.amount_total AS order_amount_total,

                    so.partner_id AS partner_id,
                    so.user_id AS salesperson_id,
                    so.company_id AS company_id,
                    so.currency_id AS currency_id,

                    am.id AS invoice_id,
                    am.name AS invoice_ref,
                    am.invoice_date AS invoice_date,
                    am.payment_state AS payment_state,
                    am.amount_total AS invoice_amount_total,
                    am.amount_residual AS invoice_amount_residual,

                    CASE
                        WHEN am.id IS NULL THEN 'to_invoice'
                        WHEN am.payment_state IN ('paid', 'in_payment') THEN 'paid'
                        WHEN am.payment_state = 'partial' THEN 'partially_paid'
                        ELSE 'unpaid'
                    END AS order_bucket

                FROM sale_order so
                LEFT JOIN sale_order_line sol
                    ON sol.order_id = so.id
                LEFT JOIN sale_order_line_invoice_rel rel
                    ON rel.order_line_id = sol.id
                LEFT JOIN account_move_line aml
                    ON aml.id = rel.invoice_line_id
                LEFT JOIN account_move am
                    ON am.id = aml.move_id
                    AND am.move_type = 'out_invoice'
                    AND am.state = 'posted'

                WHERE so.state IN ('sale', 'done')

                GROUP BY
                    so.id, am.id
            )
        """ % self._table)

    @api.model
    def get_dashboard_data(self):
        recs = self.search([])

        counts = {
            'to_invoice': 0,
            'invoiced': 0,
            'paid': 0,
            'partially_paid': 0,
            'unpaid': 0,
        }

        amounts = {
            'to_invoice': 0.0,
            'invoiced': 0.0,
            'paid': 0.0,
            'partially_paid': 0.0,
            'unpaid': 0.0,
        }

        for r in recs:

            if r.order_invoice_status == 'to invoice':
                counts['to_invoice'] += 1
                amounts['to_invoice'] += r.order_amount_total or 0.0

            elif r.order_invoice_status == 'invoiced':
                counts['invoiced'] += 1
                amounts['invoiced'] += r.order_amount_total or 0.0

            if r.payment_state in ('paid', 'in_payment'):
                counts['paid'] += 1
                amounts['paid'] += r.invoice_amount_total or 0.0

            elif r.payment_state == 'partial':
                counts['partially_paid'] += 1
                amounts['partially_paid'] += r.invoice_amount_total or 0.0

            elif r.payment_state == 'not_paid':
                counts['unpaid'] += 1
                amounts['unpaid'] += r.invoice_amount_total or 0.0

        today = fields.Date.today()
        months = [(today - relativedelta(months=i)).strftime('%Y-%m') for i in range(5, -1, -1)]

        trend = {
            m: {
                'to_invoice': 0,
                'paid': 0,
                'partially_paid': 0,
                'unpaid': 0,
            }
            for m in months
        }

        six_months_ago = today - relativedelta(months=6)

        for r in recs.filtered(lambda x: x.order_date and x.order_date >= six_months_ago):

            key = r.order_date.strftime('%Y-%m')

            if key not in trend:
                continue

            if r.order_invoice_status == 'to invoice':
                trend[key]['to_invoice'] += 1

            elif r.payment_state in ('paid', 'in_payment'):
                trend[key]['paid'] += 1

            elif r.payment_state == 'partial':
                trend[key]['partially_paid'] += 1

            elif r.payment_state == 'not_paid':
                trend[key]['unpaid'] += 1

        customer_due = {}
        salesperson_due = {}

        for r in recs:
            residual = r.invoice_amount_residual or 0.0
            if not residual:
                continue

            partner_name = r.partner_id.name or 'Unknown'
            customer_due[partner_name] = customer_due.get(partner_name, 0.0) + residual

            sp_name = r.salesperson_id.name or 'Unassigned'
            salesperson_due[sp_name] = salesperson_due.get(sp_name, 0.0) + residual

        top_customers = sorted(customer_due.items(), key=lambda x: x[1], reverse=True)[:10]
        salesperson_breakdown = sorted(salesperson_due.items(), key=lambda x: x[1], reverse=True)

        return {
            'counts': counts,
            'amounts': amounts,
            'trend_labels': months,
            'trend_data': trend,
            'top_customers': {
                'labels': [c[0] for c in top_customers],
                'data': [round(c[1], 2) for c in top_customers],
            },
            'salesperson_ar': {
                'labels': [s[0] for s in salesperson_breakdown],
                'data': [round(s[1], 2) for s in salesperson_breakdown],
            },
        }
