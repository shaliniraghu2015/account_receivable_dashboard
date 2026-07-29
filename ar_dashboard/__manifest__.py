{
    'name': 'Accounts Receivable Dashboard',
    'version': '17.0.1.0.0',
    'summary': 'The Accounts Receivable Dashboard is a powerful Odoo module that provides a '
               'centralized view of your customer receivables. It helps accountants and finance'
               ' teams monitor outstanding invoices, payment status, overdue amounts, and receivable trends'
               ' without navigating through multiple reports. The dashboard presents key financial metrics '
               'using KPI cards, interactive charts, and graphical reports,'
               ' allowing users to quickly identify pending collections and make informed business decisions.',
    'category': 'Accounting',
    'description': 'The Accounts Receivable Dashboard is a powerful Odoo module that provides a '
               'centralized view of your customer receivables. It helps accountants and finance'
               ' teams monitor outstanding invoices, payment status, overdue amounts, and receivable trends'
               ' without navigating through multiple reports.',
    'images': ['static/description/banner.png'],
    'sequence': 1,
    'price': 19.90,
    'author': "Raghubal",
    'currency': 'EUR',
    'depends': ['sale', 'account'],
    'data': [
        'security/ir.model.access.csv',
        'views/ar_dashboard_views.xml',
        'views/ar_dashboard_menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'ar_dashboard/static/src/css/style.css',
            'ar_dashboard/static/src/js/ar_dashboard.js',
            'ar_dashboard/static/src/xml/ar_dashboard_template.xml',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'OPL-3',
}
