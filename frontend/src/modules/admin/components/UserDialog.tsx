// Crear o editar un usuario (RF-030; H3 #21): nombre, usuario, correo, contraseña, PIN, roles y
// sucursales. Al editar: activar/desactivar, desbloquear y poner o quitar el PIN.
// La contraseña y el PIN nunca se muestran: solo se escriben nuevos.
import {
  passwordSchema,
  pinSchema,
  usernameSchema,
  type AdminUser,
  type Role,
} from '@mise/shared/contracts/auth';
import { newId } from '@mise/shared/domain/ids';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { Badge, Button, Modal, Switch, TextInput } from '../../../core/ui/index.js';
import { useCreateUser, useSetUserPin, useUpdateUser } from '../api/users-api.js';

function errorText(e: unknown) {
  return e instanceof ApiError ? e.message : e ? 'No se pudo guardar' : null;
}

const issue = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? undefined : r.error?.issues[0]?.message;

export interface UserDialogProps {
  /** null = usuario nuevo */
  user: AdminUser | null;
  roles: Role[];
  branches: { id: string; name: string }[];
  /** Quien edita no puede desactivarse a sí mismo */
  selfId: string | null;
  onClose: () => void;
}

function toggle(list: string[], id: string, on: boolean) {
  return on ? [...list, id] : list.filter((x) => x !== id);
}

export function UserDialog({ user, roles, branches, selfId, onClose }: UserDialogProps) {
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>(user?.roleIds ?? []);
  const [branchIds, setBranchIds] = useState<string[]>(
    user?.branchIds ?? (branches.length === 1 ? [branches[0]!.id] : []),
  );
  const [active, setActive] = useState(user?.active ?? true);
  const [unlock, setUnlock] = useState(false);
  const [id] = useState(() => user?.id ?? newId());
  const create = useCreateUser();
  const update = useUpdateUser();
  const setUserPin = useSetUserPin();

  const usernameError = user || !username ? undefined : issue(usernameSchema.safeParse(username));
  const passwordError =
    !password || passwordSchema.safeParse(password).success ? undefined : 'Mínimo 10 caracteres';
  const pinError = !pin || pinSchema.safeParse(pin).success ? undefined : 'De 4 a 6 dígitos';
  const valid =
    fullName.trim().length > 0 &&
    roleIds.length > 0 &&
    branchIds.length > 0 &&
    !passwordError &&
    (user ? true : username.length > 0 && !usernameError && password.length > 0 && !pinError);
  const pending = create.isPending || update.isPending;
  const error = errorText(create.error ?? update.error);
  const isSelf = user !== null && user.id === selfId;

  const save = () => {
    if (!valid) return;
    const mail = email.trim() || null;
    if (user) {
      update.mutate(
        {
          id: user.id,
          body: {
            fullName: fullName.trim(),
            email: mail,
            active,
            roleIds,
            branchIds,
            ...(password ? { password } : {}),
            ...(unlock ? { unlock: true } : {}),
          },
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(
        {
          id,
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: mail,
          password,
          ...(pin ? { pin } : {}),
          roleIds,
          branchIds,
        },
        { onSuccess: onClose },
      );
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? user.fullName : 'Nuevo usuario'}
      description={
        user
          ? `Usuario: ${user.username}`
          : 'Entra con usuario y contraseña; en los dispositivos compartidos, con su PIN.'
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextInput
          label="Nombre"
          value={fullName}
          maxLength={80}
          required
          autoComplete="off"
          onChange={(e) => setFullName(e.target.value)}
        />
        {!user && (
          <TextInput
            label="Usuario"
            hint="Con este nombre entra. Sin espacios; se guarda en minúsculas."
            value={username}
            maxLength={40}
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            error={usernameError}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        <TextInput
          label="Correo (opcional)"
          type="email"
          value={email}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            label={user ? 'Nueva contraseña' : 'Contraseña'}
            hint={user ? 'Déjala vacía para no cambiarla' : 'Mínimo 10 caracteres'}
            type="password"
            value={password}
            required={!user}
            autoComplete="new-password"
            error={passwordError}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!user && (
            <TextInput
              label="PIN (opcional)"
              hint="De 4 a 6 dígitos, para entrar rápido y autorizar 🔑"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              autoComplete="off"
              error={pinError}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          )}
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-base font-semibold">Roles</legend>
          <p className="text-sm text-secondary">Los permisos se suman si tiene varios.</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {roles.map((r) => (
              <label
                key={r.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface"
              >
                <input
                  type="checkbox"
                  className="size-5"
                  checked={roleIds.includes(r.id)}
                  onChange={(e) => setRoleIds(toggle(roleIds, r.id, e.target.checked))}
                />
                <span className="text-base">{r.name}</span>
              </label>
            ))}
          </div>
          {roleIds.length === 0 && <p className="text-sm">Elige al menos un rol.</p>}
        </fieldset>

        {branches.length > 1 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-base font-semibold">Sucursales</legend>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {branches.map((b) => (
                <label
                  key={b.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={branchIds.includes(b.id)}
                    onChange={(e) => setBranchIds(toggle(branchIds, b.id, e.target.checked))}
                  />
                  <span className="text-base">{b.name}</span>
                </label>
              ))}
            </div>
            {branchIds.length === 0 && <p className="text-sm">Elige al menos una sucursal.</p>}
          </fieldset>
        )}

        {user && (
          <>
            <Switch
              label="Activo"
              hint={
                isSelf
                  ? 'No puedes desactivar tu propio usuario'
                  : 'Desactivado ya no entra y se cierran sus sesiones'
              }
              checked={active}
              disabled={isSelf}
              onChange={setActive}
            />
            {user.locked && (
              <Switch
                label="Desbloquear"
                hint="Está bloqueado por intentos fallidos. Cambiar la contraseña también lo desbloquea."
                checked={unlock}
                onChange={setUnlock}
              />
            )}
          </>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid} loading={pending}>
            {user ? 'Guardar' : 'Crear usuario'}
          </Button>
        </div>
      </form>

      {user && <PinSection user={user} pending={setUserPin.isPending} mutation={setUserPin} />}
    </Modal>
  );
}

function PinSection({
  user,
  mutation,
  pending,
}: {
  user: AdminUser;
  mutation: ReturnType<typeof useSetUserPin>;
  pending: boolean;
}) {
  const [pin, setPin] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const pinError = !pin || pinSchema.safeParse(pin).success ? undefined : 'De 4 a 6 dígitos';
  const error = errorText(mutation.error);
  const run = (value: string | null) =>
    mutation.mutate(
      { id: user.id, pin: value },
      {
        onSuccess: () => {
          setPin('');
          setDone(value ? 'PIN guardado' : 'PIN quitado');
        },
      },
    );

  return (
    <section
      aria-labelledby="pin-title"
      className="mt-6 flex flex-col gap-3 border-t border-accent pt-4"
    >
      <div className="flex items-center gap-3">
        <h3 id="pin-title" className="text-base font-semibold">
          PIN
        </h3>
        <Badge tone={user.hasPin ? 'success' : 'neutral'}>
          {user.hasPin ? 'Tiene PIN' : 'Sin PIN'}
        </Badge>
      </div>
      <p className="text-sm text-secondary">
        Sirve para entrar en los dispositivos compartidos y para autorizar 🔑. Se cambia aparte de
        la contraseña.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin && !pinError) run(pin);
        }}
      >
        <TextInput
          label={user.hasPin ? 'Nuevo PIN' : 'PIN'}
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          autoComplete="off"
          error={pinError}
          onChange={(e) => {
            setDone(null);
            setPin(e.target.value.replace(/\D/g, ''));
          }}
        />
        <Button type="submit" variant="secondary" disabled={!pin || !!pinError} loading={pending}>
          Guardar PIN
        </Button>
        {user.hasPin && (
          <Button variant="outline" disabled={pending} onClick={() => run(null)}>
            Quitar PIN
          </Button>
        )}
      </form>
      {done && (
        <p role="status" className="text-sm">
          {done}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
        >
          {error}
        </p>
      )}
    </section>
  );
}
