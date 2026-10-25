export function requiresConfirmation(operation, args) {
  return (
    operation.effect.includes("destructive") ||
    operation.effect.includes("secret") ||
    operation.effect === "publish" ||
    (operation.command === "keys update" && args.isActive === false)
  );
}
