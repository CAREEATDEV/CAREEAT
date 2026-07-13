export function vagueHint(goalMl: number) {
  const goal = Math.round(goalMl);
  return {
    title: 'LA VAGUE 🌊',
    body:
      `Ta vague, c'est le nombre de jours de suite où tu as bu assez d'eau pour atteindre ton objectif du jour (environ ${goal} mL, selon ton poids).\n\n` +
      `Chaque jour réussi fait grandir ta vague. Si tu n'as pas encore atteint l'objectif aujourd'hui, la vague des jours précédents est conservée — mais elle retombe à zéro dès qu'un jour passé n'a pas atteint l'objectif.\n\n` +
      `Garde ta vague vivante : bois chaque jour.`,
  };
}
