import {
  assertCompletable,
  assertTransition,
  assertVersion,
  quantity,
  tomanToRial,
} from './rules';
import type {
  Actor,
  Item,
  OrderView,
} from '../../../../../../packages/shared/src/contracts';
const actor: Actor = {
  userId: 'u',
  tenantId: 't',
  branchId: 'b',
  role: 'KITCHEN',
};
const item: Item = {
  id: 'i',
  menuItemId: 'm',
  name: 'برگر',
  quantity: 1,
  priceRial: 4500000,
  status: 'PENDING',
  version: 1,
};
describe('business invariants', () => {
  test('money conversion is exact and rejects invalid precision/range', () => {
    expect(tomanToRial(450000)).toBe(4500000);
    for (const n of [-1, 0, 0.1, 100000001, NaN])
      expect(() => tomanToRial(n)).toThrow('INVALID_PRICE');
  });
  test('quantity bounds reject fractions and invalid input', () => {
    expect(quantity(99)).toBe(99);
    for (const n of [-1, 0, 1.5, 100])
      expect(() => quantity(n)).toThrow('INVALID_QUANTITY');
  });
  test('kitchen cannot skip states or serve', () => {
    expect(() => assertTransition(actor, item, 'PREPARING')).not.toThrow();
    expect(() => assertTransition(actor, item, 'READY')).toThrow(
      'INVALID_TRANSITION',
    );
    expect(() =>
      assertTransition(actor, { ...item, status: 'READY' }, 'SERVED'),
    ).toThrow('FORBIDDEN');
  });
  test('waiter serves ready items but cannot prepare', () => {
    expect(() =>
      assertTransition(
        { ...actor, role: 'WAITER' },
        { ...item, status: 'READY' },
        'SERVED',
      ),
    ).not.toThrow();
    expect(() =>
      assertTransition({ ...actor, role: 'WAITER' }, item, 'PREPARING'),
    ).toThrow('FORBIDDEN');
  });
  test('stale versions conflict and close requires served nonempty order', () => {
    expect(() => assertVersion(2, 1)).toThrow('VERSION_CONFLICT');
    const order = { status: 'OPEN', items: [] } as unknown as OrderView;
    expect(() => assertCompletable(order)).toThrow('ITEMS_NOT_SERVED');
    expect(() =>
      assertCompletable({ ...order, items: [{ ...item, status: 'SERVED' }] }),
    ).not.toThrow();
  });
});
