import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMarketplaceOpportunity, rankMarketplaceOpportunities } from '../src/lib/marketplaceOpportunity.mjs';

const sample = {
 sku:'EIG-TEST-001', channel:'walmart', expectedSalePrice:79, wholesaleUnitCost:40,
 outboundShipping:8, packagingCost:1, marketplaceFeeRate:0.15,
 expectedReturnCost:2, unitsAvailable:50, unitsProposed:10,
 authorizedSupplier:true, authorizedToList:true, restrictionStatus:'approved',
 demand:'verified', evidence:['supplier:contract/001','marketplace:offer/001']
};
test('computes conservative unit economics and never automatically purchases or lists', () => {
 const s=evaluateMarketplaceOpportunity(sample);
 assert.equal(s.marketplaceFee,11.85);
 assert.equal(s.unitProfit,16.15);
 assert.equal(s.marginPct,20.44);
 assert.equal(s.proposedInventoryCost,400);
 assert.equal(s.status,'eligible_for_human_purchase_review');
 assert.equal(s.approvalRequired,true);
 assert.equal(s.mayAutoPurchase,false);
 assert.equal(s.mayAutoList,false);
});
test('an out-of-stock listing without demand evidence cannot be approved', () => {
 const s=evaluateMarketplaceOpportunity({...sample,demand:'unverified',evidence:[]});
 assert.equal(s.status,'needs_review');
 assert.ok(s.blockers.includes('demand_not_verified_with_evidence'));
});
test('unverified supplier authorization and listing rights are blocking', () => {
 const s=evaluateMarketplaceOpportunity({...sample,authorizedSupplier:false,authorizedToList:false,restrictionStatus:'restricted'});
 assert.ok(s.blockers.includes('supplier_authorization_unverified'));
 assert.ok(s.blockers.includes('marketplace_listing_eligibility_unverified'));
});
test('negative margin and oversold proposed purchases are blocked', () => {
 const s=evaluateMarketplaceOpportunity({...sample,wholesaleUnitCost:75,unitsProposed:60});
 assert.ok(s.blockers.includes('nonpositive_unit_profit'));
 assert.ok(s.blockers.includes('insufficient_verified_stock'));
});
test('invalid pricing, fees and quantities reject before scoring', () => {
 assert.throws(()=>evaluateMarketplaceOpportunity({...sample,marketplaceFeeRate:1.2}),/fee/);
 assert.throws(()=>evaluateMarketplaceOpportunity({...sample,wholesaleUnitCost:-1}),/price or cost/);
 assert.throws(()=>evaluateMarketplaceOpportunity({...sample,unitsProposed:1.5}),/quantity/);
});
test('ranks human-review eligible opportunities before unverified ones', () => {
 const res=rankMarketplaceOpportunities([{...sample,sku:'RISK',demand:'unverified'},{...sample,sku:'SAFE'}]);
 assert.equal(res[0].sku,'SAFE');
});
