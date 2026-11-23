var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

function riceItem() {
  return {
    id: 1,
    sku: 'GRN-001',
    name: 'Indrayani Basmati Rice 5kg',
    hsn: '1006',
    price: 640,
    qty: 1
  };
}

test('CURRENT BEHAVIOUR: order pricing applies the HSN slab and calculates GST after coupon discount', function () {
  var totals = pricing.computeTotals([riceItem()], 'SAVE10');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    lineGstPercent: totals.lines[0].gstPercent
  }, {
    subtotal: 640,
    discount: 64,
    taxable: 576,
    tax: 28.8,
    cgst: 14.4,
    sgst: 14.4,
    total: 604.8,
    lineGstPercent: 5
  });
});

test('invoice figures match the order-pricing totals for the customer bill', function () {
  var items = [riceItem()];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiced = invoice.computeInvoiceFigures({
    id: 2000,
    items: items,
    coupon: 'SAVE10'
  });

  assert.deepEqual({
    subtotal: invoiced.subtotal,
    discount: invoiced.discount,
    tax: invoiced.tax,
    cgst: invoiced.cgst,
    sgst: invoiced.sgst,
    total: invoiced.total
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
});

test('invoice calculation uses the item HSN slab when gstRate is absent', function () {
  var figures = invoice.computeInvoiceFigures({
    id: 2001,
    items: [riceItem()],
    coupon: ''
  });

  assert.deepEqual({
    subtotal: figures.subtotal,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    lineGstPercent: figures.rows[0].gstPercent
  }, {
    subtotal: 640,
    tax: 32,
    cgst: 16,
    sgst: 16,
    total: 672,
    lineGstPercent: 5
  });
});

test('invoice percentage coupon matches the order-pricing discount', function () {
  var figures = invoice.computeInvoiceFigures({
    id: 2002,
    items: [riceItem()],
    coupon: 'SAVE10'
  });

  assert.deepEqual({
    subtotal: figures.subtotal,
    tax: figures.tax,
    discount: figures.discount,
    total: figures.total
  }, {
    subtotal: 640,
    tax: 28.8,
    discount: 64,
    total: 604.8
  });
});

test('rendered invoice matches the stored ledger total without a reconciliation warning', function () {
  var order = {
    id: 2003,
    date: '01/01/2022',
    customer: 'In-memory Customer',
    paymentMode: 'cash',
    status: 'completed',
    items: [riceItem()],
    coupon: 'SAVE10',
    total: pricing.computeTotals([riceItem()], 'SAVE10').total
  };

  var html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /\u20b9604\.80/);
  assert.match(html, />5%<\/td>/);
});
