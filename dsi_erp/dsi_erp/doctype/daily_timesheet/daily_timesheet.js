// Copyright (c) 2025, Siva and contributors
// For license information, please see license.txt

frappe.ui.form.on("Daily Timesheet", {
    refresh: function(frm) {
        if (!frm.is_new()) return;

		frm.add_custom_button("Fetch Employees", function() {
			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Employee",
				filters: { status: "Active" },
				fields: ["name", "employee_name"]
				},
				callback: function(r) {
					frm.clear_table("timesheet");
					(r.message || []).forEach(emp => {
						let row = frm.add_child("timesheet");
						row.employee = emp.name;
						row.employee_name = emp.employee_name;
						row.hours = frm.doc.default_hours;
						row.project = frm.doc.project;
					});
					frm.refresh_field("timesheet");
				}
			});
		});
    }
});

// Child row: filter task by row.project or parent project
frappe.ui.form.on("Daily Timesheet Employee", {
    employee: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.employee) {
            frappe.db.get_value("Employee", row.employee, ["employee_name"]).then(({ message }) => {
                if (!message) return;
                frappe.model.set_value(cdt, cdn, "employee_name", message.employee_name || "");
            });
        }
    },
    project: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        frm.fields_dict["timesheet"].grid.get_field("task").get_query = function(doc, cdt2, cdn2) {
            const r = locals[cdt2][cdn2];
            return {
                filters: {
                    project: r.project || frm.doc.project || null
                }
            };
        };
        // clear task if it no longer matches the selected project
        if (row.task) {
            frappe.model.set_value(cdt, cdn, "task", null);
        }
    },
    timesheet_on_form_rendered: function(frm) {
        // bind query for existing rows when grid renders
        frm.fields_dict["timesheet"].grid.get_field("task").get_query = function(doc, cdt2, cdn2) {
            const r = locals[cdt2][cdn2];
            return {
                filters: {
                    project: r.project || frm.doc.project || null
                }
            };
        };
    },
    timesheet_add: function(frm, cdt, cdn) {
        // ensure query is applied when a new row is added
        const grid_field = frm.fields_dict["timesheet"].grid.get_field("task");
        grid_field.get_query = function(doc, cdt2, cdn2) {
            const r = locals[cdt2][cdn2];
            return {
                filters: {
                    project: r.project || frm.doc.project || null
                }
            };
        };
    }
});

// When parent project changes, cascade to child rows without a project
frappe.ui.form.on("Daily Timesheet", {
    project: function(frm) {
        (frm.doc.timesheet || []).forEach(row => {
            if (!row.project) {
                row.project = frm.doc.project;
            }
            // clear task in all rows so user picks a valid one for the new project
            if (row.task) {
                row.task = null;
            }
        });
        frm.refresh_field("timesheet");
    }
});