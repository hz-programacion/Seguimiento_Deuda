# Especificación de Seguridad Firestore · ArgenCaja (Zero-Trust ABAC + RBAC)

## 1. Invariantes de Datos y Roles
1. **Administrador Maestro (`hz.mdiego@gmail.com`)**: Único usuario pre-autorizado automáticamente (`request.auth.token.email == 'hz.mdiego@gmail.com' && request.auth.token.email_verified == true`). Puede crear, editar y eliminar movimientos, aprobar o revocar miembros, y ajustar reglas del hogar.
2. **Colaboradora de Comprobantes (`HERMANA_COMPROBANTES`)**: Solo accede si existe un documento activo en `/households/{householdId}/members/{uid}` con `status == 'ACTIVO'` (otorgado por aprobación del administrador o reclamando una pre-invitación válida en `/invites/{inviteId}`). Tiene acceso de lectura a los movimientos y únicamente puede modificar `['adjuntos', 'updatedAt', 'updatedByUid']` en `items`. Tiene terminantemente prohibido crear/eliminar ítems o alterar montos, fechas, categorías o estados.
3. **Intrusos / Usuarios No Verificados**: Cualquier usuario sin correo verificado (`email_verified != true`) o sin membresía activa tiene bloqueo total (`PERMISSION_DENIED`) sobre `/households/{householdId}` y `/items`. Solo puede registrar una única solicitud en `/accessRequests/{request.auth.uid}` con `status == 'PENDIENTE'`.
4. **Aislamiento de PII**: `members`, `invites` y `accessRequests` contienen direcciones de correo (`emailLower`) y solo son legibles por el propio titular o por el administrador del hogar.
5. **Integridad Temporal e Inmutabilidad**: `createdAt` debe igualar `request.time` al crear y permanecer inmutable en `update`; `updatedAt` debe igualar `request.time` en `create` y `update`; `id`, `householdId` y `ownerUid` son inmutables.
6. **Cero `get()`/`exists()` en `allow list`**: Ninguna regla `allow list` ejecuta lecturas cruzadas; se evalúa `resource.data` (`allowedUids` / `allowedEmails` / `uid` / `emailLower`).

## 2. "Dirty Dozen" Payloads Maliciosos (Deben devolver PERMISSION_DENIED)
1. **Self-Role Escalation**: Colaboradora intenta crear `members/{uid}` con `role: "ADMIN"` sin invitación previa -> Rechazado por `isHouseholdAdmin` / ausencia de `invite`.
2. **Invite Forgery**: Colaboradora intenta crear su propio documento en `invites/{inviteId}` -> Rechazado porque solo `isHouseholdAdmin` puede escribir `invites`.
3. **Collaborator Amount Tampering**: Colaboradora intenta `update` en `items/{itemId}` cambiando `montoPactado` de `94520.4` a `1` -> Rechazado por `affectedKeys().hasOnly(['adjuntos', 'updatedAt', 'updatedByUid'])`.
4. **Collaborator Status Override**: Colaboradora intenta marcar un ítem como `estado: "PAGADO"` o cambiar `fechaExactaVencimiento` -> Rechazado por `affectedKeys().hasOnly(...)`.
5. **Collaborator Item Deletion / Creation**: Colaboradora intenta `create` o `delete` sobre `items/{itemId}` -> Rechazado porque solo `isHouseholdAdmin` crea y elimina ítems.
6. **Shadow Field Injection**: Cualquier cliente intenta agregar un campo fantasma (`isSuperAdmin: true`) en `items` o `members` -> Rechazado por `data.keys().hasOnly(...)` y `affectedKeys().hasOnly(...)`.
7. **Unverified Admin Email Spoof**: Cuenta con email `hz.mdiego@gmail.com` pero `email_verified: false` intenta leer o escribir -> Rechazado por `isVerifiedUser()`.
8. **ID Poisoning / DoW**: Intento de crear un documento con `itemId` de 1500 caracteres o caracteres inválidos (`../../etc`) -> Rechazado por `isValidId()`.
9. **Oversized Array / String DoW**: Intento de escribir `adjuntos` con 50 elementos o `notas` de 50KB -> Rechazado por `.size() <= 20` y `notas.size() <= 1000`.
10. **PII Scraping**: Usuario autenticado no-admin intenta hacer `get` o `list` sobre `members` o `accessRequests` de otros usuarios -> Rechazado por `isHouseholdAdmin` / `uid == request.auth.uid`.
11. **Timestamp Forgery / Immutable Tampering**: Cliente intenta modificar `createdAt` o `ownerUid` en `update` o enviar `updatedAt` pasado -> Rechazado por `updatedAt == request.time` e inmutabilidad.
12. **Revoked Collaborator Access**: Colaboradora previamente aprobada cuyo documento `members/{uid}` fue marcado `REVOCADO` intenta leer `get` o subir un comprobante -> Rechazado inmediatamente por Master Gate `isHouseholdCollaborator()`.
