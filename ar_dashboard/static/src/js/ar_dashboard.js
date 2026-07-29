odoo.define('ar_dashboard.ArDashboard', function (require) {
"use strict";

var AbstractAction = require('web.AbstractAction');
var core = require('web.core');
var rpc = require('web.rpc');

var ArDashboard = AbstractAction.extend({
    template: 'ArDashboard',

    events: {
        'click .open_to_invoice': '_onOpenToInvoice',
        'click .open_invoiced': '_onOpenInvoiced',
        'click .open_paid': '_onOpenPaid',
        'click .open_partial': '_onOpenPartial',
        'click .open_unpaid': '_onOpenUnpaid',
    },

    willStart: function () {
        var self = this;
        return Promise.all([
            this._super.apply(this, arguments),
            rpc.query({
                model: 'ar.dashboard.report',
                method: 'get_dashboard_data',
                args: [],
            }).then(function (data) {
                self.dashboard_data = data;
            }),
        ]);
    },

    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self._renderCharts();
        });
    },

    _renderCharts: function () {
        var d = this.dashboard_data;

        this.trend_chart = new Chart(this.$('#chart_ar_trend'), {
            type: 'line',
            data: {
                labels: d.trend_labels,
                datasets: [
                    {
                        label: 'To Invoice',
                        data: d.trend_labels.map(function (m) { return d.trend_data[m].to_invoice; }),
                        borderColor: '#6c757d',
                        fill: false,
                    },
                    {
                        label: 'Paid',
                        data: d.trend_labels.map(function (m) { return d.trend_data[m].paid; }),
                        borderColor: '#28a745',
                        fill: false,
                    },
                    {
                        label: 'Partially Paid',
                        data: d.trend_labels.map(function (m) { return d.trend_data[m].partially_paid; }),
                        borderColor: '#ffc107',
                        fill: false,
                    },
                    {
                        label: 'Unpaid',
                        data: d.trend_labels.map(function (m) { return d.trend_data[m].unpaid; }),
                        borderColor: '#dc3545',
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        this.status_chart = new Chart(this.$('#chart_ar_status'), {
            type: 'doughnut',
            data: {
                labels: ['To Invoice', 'Paid', 'Partially Paid', 'Unpaid'],
                datasets: [{
                    data: [
                        d.counts.to_invoice,
                        d.counts.paid,
                        d.counts.partially_paid,
                        d.counts.unpaid,
                    ],
                    backgroundColor: ['#6c757d', '#28a745', '#ffc107', '#dc3545'],
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        this.top_customers_chart = new Chart(this.$('#chart_top_customers'), {
            type: 'bar',
            data: {
                labels: d.top_customers.labels,
                datasets: [{
                    label: 'Amount Due',
                    data: d.top_customers.data,
                    backgroundColor: '#6f42c1',
                }],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
            },
        });

        this.salesperson_ar_chart = new Chart(this.$('#chart_salesperson_ar'), {
            type: 'bar',
            data: {
                labels: d.salesperson_ar.labels,
                datasets: [{
                    label: 'Amount Due',
                    data: d.salesperson_ar.data,
                    backgroundColor: '#17a2b8',
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
            },
        });

        var self = this;
        requestAnimationFrame(function () {
            if (self.trend_chart) { self.trend_chart.resize(); }
            if (self.status_chart) { self.status_chart.resize(); }
            if (self.top_customers_chart) { self.top_customers_chart.resize(); }
            if (self.salesperson_ar_chart) { self.salesperson_ar_chart.resize(); }
        });
    },

    destroy: function () {
        if (this.trend_chart) { this.trend_chart.destroy(); }
        if (this.status_chart) { this.status_chart.destroy(); }
        if (this.top_customers_chart) { this.top_customers_chart.destroy(); }
        if (this.salesperson_ar_chart) { this.salesperson_ar_chart.destroy(); }
        this._super.apply(this, arguments);
    },

    _onOpenToInvoice: function () { this._openFiltered('to_invoice'); },
    _onOpenInvoiced: function () { this._openFiltered('invoiced'); },
    _onOpenPaid: function () { this._openFiltered('paid'); },
    _onOpenPartial: function () { this._openFiltered('partially_paid'); },
    _onOpenUnpaid: function () { this._openFiltered('unpaid'); },

    _openFiltered: function (bucket) {
        var domains = {
            to_invoice:     [['order_invoice_status', '=', 'to invoice']],
            invoiced:       [['order_invoice_status', '=', 'invoiced']],
            paid:           ['|', ['payment_state', '=', 'paid'], ['payment_state', '=', 'in_payment']],
            partially_paid: [['payment_state', '=', 'partial']],
            unpaid:         [['payment_state', '=', 'not_paid']],
        };

        var names = {
            to_invoice: 'Orders To Invoice',
            invoiced: 'Invoiced Orders',
            paid: 'Paid Orders',
            partially_paid: 'Partially Paid Orders',
            unpaid: 'Unpaid Orders',
        };

        this.do_action({
            name: names[bucket],
            type: 'ir.actions.act_window',
            res_model: 'ar.dashboard.report',
            views: [[false, 'list'], [false, 'form']],
            domain: domains[bucket],
        });
    },

    _openInvoiced: function () {
        this.do_action({
            name: 'Invoiced Orders',
            type: 'ir.actions.act_window',
            res_model: 'ar.dashboard.report',
            views: [[false, 'list'], [false, 'form']],
            domain: [['invoice_id', '!=', false]],
        });
    },
});

core.action_registry.add('ar_dashboard_tag', ArDashboard);

return ArDashboard;

});