import assert from 'node:assert/strict';
import test from 'node:test';

import { assertAllowedPermissionMode, findPermissionModeViolation } from '@/shared/permission-modes.js';

test('default, acceptEdits, plan and an absent mode are allowed', () => {
  for (const permissionMode of [undefined, '', 'default', 'acceptEdits', 'plan']) {
    assert.equal(findPermissionModeViolation({ permissionMode }), null, String(permissionMode));
  }
  assert.equal(findPermissionModeViolation(undefined), null);
});

test('bypassPermissions, auto, dontAsk and unknown modes are refused', () => {
  for (const permissionMode of ['bypassPermissions', 'auto', 'dontAsk', 'yolo', 7]) {
    assert.ok(findPermissionModeViolation({ permissionMode }), String(permissionMode));
  }
});

test('skipPermissions in any form is refused', () => {
  assert.ok(findPermissionModeViolation({ skipPermissions: true }));
  assert.ok(findPermissionModeViolation({ toolsSettings: { skipPermissions: true } }));
  assert.ok(findPermissionModeViolation({ allowDangerouslySkipPermissions: true }));
  assert.throws(() => assertAllowedPermissionMode({ permissionMode: 'bypassPermissions' }), /not allowed/);
});
