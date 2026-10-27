import { CONFIG } from "../config";

export function hasStaffRole(member: unknown): boolean {
	if (!member || typeof member !== "object") return false;
	if (!("roles" in member)) return false;
	const roles = (member as { roles: { cache: { has: (id: string) => boolean } } }).roles;
	if (!roles || !("cache" in roles)) return false;
	const roleIds = [CONFIG.roles.staffId, CONFIG.roles.mgmtId, CONFIG.roles.botdevId].filter(Boolean);
	return roleIds.some((id) => roles.cache.has(String(id)));
}
