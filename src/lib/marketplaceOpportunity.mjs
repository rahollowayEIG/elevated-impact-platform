// EIG Marketplace Opportunity Engine: offline, evidence-driven scoring only.
// Does not fetch marketplace pages, create listings, place orders, or purchase inventory.
const finiteNonnegative = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const validRate = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

export function evaluateMarketplaceOpportunity(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Opportunity input required');
  const { sku, channel, expectedSalePrice, wholesaleUnitCost, outboundShipping,
    packagingCost = 0, inboundShippingPerUnit = 0, marketplaceFeeRate,
    fulfillmentFee = 0, expectedReturnCost = 0, advertisingCost = 0,
    unitsAvailable, unitsProposed = 0, authorizedSupplier, authorizedToList,
    evidence = [], demand = 'unverified', restrictionStatus = 'unverified' } = input;
  if (typeof sku !== 'string' || !sku.trim()) throw new Error('SKU required');
  if (!['walmart','amazon','other'].includes(channel)) throw new Error('Unsupported channel');
  const costs = [expectedSalePrice, wholesaleUnitCost, outboundShipping, packagingCost,
    inboundShippingPerUnit, fulfillmentFee, expectedReturnCost, advertisingCost];
  if (!costs.every(finiteNonnegative) || !expectedSalePrice) throw new Error('Invalid price or cost');
  if (!validRate(marketplaceFeeRate)) throw new Error('Invalid fee rate');
  if (!Number.isInteger(unitsProposed) || unitsProposed < 0) throw new Error('Invalid proposed quantity');
  if (unitsAvailable !== undefined && (!Number.isInteger(unitsAvailable) || unitsAvailable < 0)) throw new Error('Invalid available quantity');
  if (!['verified','indicative','unverified'].includes(demand)) throw new Error('Invalid demand state');
  if (!['approved','restricted','unverified'].includes(restrictionStatus)) throw new Error('Invalid restriction state');
  if (!Array.isArray(evidence) || evidence.some(x => typeof x !== 'string' || !x.trim())) throw new Error('Evidence must be source references');
  const fee = money(expectedSalePrice * marketplaceFeeRate);
  const estimatedCost = money(wholesaleUnitCost + outboundShipping + packagingCost +
    inboundShippingPerUnit + fulfillmentFee + expectedReturnCost + advertisingCost + fee);
  const profit = money(expectedSalePrice - estimatedCost);
  const marginPct = money(profit / expectedSalePrice * 100);
  const breakEvenPrice = marketplaceFeeRate === 1 ? null : money((estimatedCost - fee) / (1 - marketplaceFeeRate));
  const blockers = [];
  if (authorizedSupplier !== true) blockers.push('supplier_authorization_unverified');
  if (authorizedToList !== true || restrictionStatus !== 'approved') blockers.push('marketplace_listing_eligibility_unverified');
  if (unitsAvailable !== undefined && unitsProposed > unitsAvailable) blockers.push('insufficient_verified_stock');
  if (demand !== 'verified' || evidence.length === 0) blockers.push('demand_not_verified_with_evidence');
  if (profit <= 0) blockers.push('nonpositive_unit_profit');
  const status = blockers.length ? 'needs_review' : 'eligible_for_human_purchase_review';
  return Object.freeze({
    sku: sku.trim(), channel, status, blockers, demand, evidence: [...evidence],
    expectedSalePrice, estimatedCost, unitProfit: profit, marginPct, breakEvenPrice,
    marketplaceFee: fee, proposedInventoryCost: money(unitsProposed * (wholesaleUnitCost + inboundShippingPerUnit)),
    approvalRequired: true, mayAutoPurchase: false, mayAutoList: false,
  });
}

export function rankMarketplaceOpportunities(items) {
  if (!Array.isArray(items)) throw new Error('Items must be an array');
  return items.map(evaluateMarketplaceOpportunity).sort((a,b) =>
    Number(b.status === 'eligible_for_human_purchase_review') - Number(a.status === 'eligible_for_human_purchase_review') ||
    b.marginPct - a.marginPct || a.sku.localeCompare(b.sku));
}
