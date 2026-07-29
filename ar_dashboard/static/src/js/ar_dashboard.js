/** @odoo-module **/

import { Component, useState, useRef, onWillStart, onMounted, onWillUnmount } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { loadJS } from "@web/core/assets";

export class ArDashboard extends Component {
    static template = "ar_dashboard.ArDashboard";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.actionService = useService("action");

        this.state = useState({
            data: null,
        });

        this.trendChartRef = useRef("trendChart");
        this.statusChartRef = useRef("statusChart");
        this.topCustomersChartRef = useRef("topCustomersChart");
        this.salespersonChartRef = useRef("salespersonChart");

        this.charts = {};

        onWillStart(async () => {
            await loadJS("/web/static/lib/Chart/Chart.js");
            this.state.data = await this.orm.call("ar.dashboard.report", "get_dashboard_data", []);
        });

        onMounted(() => this._renderCharts());
        onWillUnmount(() => this._destroyCharts());
    }

    _renderCharts() {
        const d = this.state.data;
        if (!d) {
            return;
        }

        this.charts.trend = new Chart(this.trendChartRef.el, {
            type: "line",
            data: {
                labels: d.trend_labels,
                datasets: [
                    {
                        label: "To Invoice",
                        data: d.trend_labels.map((m) => d.trend_data[m].to_invoice),
                        borderColor: "#6c757d",
                        fill: false,
                    },
                    {
                        label: "Paid",
                        data: d.trend_labels.map((m) => d.trend_data[m].paid),
                        borderColor: "#28a745",
                        fill: false,
                    },
                    {
                        label: "Partially Paid",
                        data: d.trend_labels.map((m) => d.trend_data[m].partially_paid),
                        borderColor: "#ffc107",
                        fill: false,
                    },
                    {
                        label: "Unpaid",
                        data: d.trend_labels.map((m) => d.trend_data[m].unpaid),
                        borderColor: "#dc3545",
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        this.charts.status = new Chart(this.statusChartRef.el, {
            type: "doughnut",
            data: {
                labels: ["To Invoice", "Paid", "Partially Paid", "Unpaid"],
                datasets: [
                    {
                        data: [d.counts.to_invoice, d.counts.paid, d.counts.partially_paid, d.counts.unpaid],
                        backgroundColor: ["#6c757d", "#28a745", "#ffc107", "#dc3545"],
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        this.charts.topCustomers = new Chart(this.topCustomersChartRef.el, {
            type: "bar",
            data: {
                labels: d.top_customers.labels,
                datasets: [
                    {
                        label: "Amount Due",
                        data: d.top_customers.data,
                        backgroundColor: "#6f42c1",
                    },
                ],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
            },
        });

        this.charts.salesperson = new Chart(this.salespersonChartRef.el, {
            type: "bar",
            data: {
                labels: d.salesperson_ar.labels,
                datasets: [
                    {
                        label: "Amount Due",
                        data: d.salesperson_ar.data,
                        backgroundColor: "#17a2b8",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
            },
        });

        requestAnimationFrame(() => {
            Object.values(this.charts).forEach((chart) => chart && chart.resize());
        });
    }

    _destroyCharts() {
        Object.values(this.charts).forEach((chart) => chart && chart.destroy());
        this.charts = {};
    }

    openFiltered(bucket) {
        const domains = {
            to_invoice: [["order_invoice_status", "=", "to invoice"]],
            invoiced: [["order_invoice_status", "=", "invoiced"]],
            paid: ["|", ["payment_state", "=", "paid"], ["payment_state", "=", "in_payment"]],
            partially_paid: [["payment_state", "=", "partial"]],
            unpaid: [["payment_state", "=", "not_paid"]],
        };
        const names = {
            to_invoice: "Orders To Invoice",
            invoiced: "Invoiced Orders",
            paid: "Paid Orders",
            partially_paid: "Partially Paid Orders",
            unpaid: "Unpaid Orders",
        };

        this.actionService.doAction({
            name: names[bucket],
            type: "ir.actions.act_window",
            res_model: "ar.dashboard.report",
            views: [
                [false, "list"],
                [false, "form"],
            ],
            domain: domains[bucket],
        });
    }
}

registry.category("actions").add("ar_dashboard_tag", ArDashboard);
