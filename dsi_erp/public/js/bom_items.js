frappe.ui.form.on("BOM Operation", {
    base_operating_cost: function(frm, cdt, cdn) {
        calculate_total_operation_cost(frm, cdt, cdn);
    },
    custom_operation_type: function(frm, cdt, cdn) {
        calculate_total_operation_cost(frm, cdt, cdn);
    },
    custom_daily_rate: function(frm, cdt, cdn) {
        calculate_total_operation_cost(frm, cdt, cdn);
    },
    custom_operation_time: function(frm, cdt, cdn) {
        calculate_total_operation_cost(frm, cdt, cdn);
    },
});

function calculate_total_operation_cost(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    // update child row fields
    frappe.model.set_value(cdt, cdn, "time_in_mins",
        (row.custom_operation_time || 0) * (row.custom_daily_operation_hours || 0) * 60
    );

    frappe.model.set_value(cdt, cdn, "hour_rate",
        (row.custom_daily_rate || 0) * (row.custom_daily_operation_hours || 0)
    );

    // now recalc totals for all operations
    let lab_total = 0;
    let eq_total = 0;

    (frm.doc.operations || []).forEach(r => {
        if (r.custom_operation_type === "Manpower") {
            lab_total += flt(r.base_operating_cost);
        }
        if (r.custom_operation_type === "Equipment") {
            eq_total += flt(r.base_operating_cost);
        }
    });

    frm.set_value("custom_labour_cost", lab_total);
    frm.set_value("custom_equipment_cost", eq_total);
}



frappe.ui.form.on("BOM Item", {
    custom_item_group: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        // set query only for this row
        frappe.utils.filter_dict(frm.fields_dict["items"].grid.grid_rows_by_docname[cdn].get_field("item_code").get_query, {
            filters: {
                "item_group": row.custom_item_group,
                "is_fixed_asset": 0,
                "include_item_in_manufacturing": 1
                
            }
        });

        frm.fields_dict["items"].grid.grid_rows_by_docname[cdn].get_field("item_code").get_query = function(doc, cdt, cdn) {
            return {
                filters: {
                    "item_group": row.custom_item_group,
                    "is_fixed_asset": 0,
                    "include_item_in_manufacturing": 1
                }
            };
        };
    }
});

