export default class TieManager {
    constructor() {
        this.groups = new Map();
    }

    register(groupId, callback) {
        if (!this.groups.has(groupId)) {
            this.groups.set(groupId, {
                datasetId: null,
                members: new Set()
            });
        }

        const group = this.groups.get(groupId);
        group.members.add(callback);

        // Neue Mitglieder übernehmen die aktuelle Auswahl
        if (group.datasetId !== null) {
            callback(group.datasetId);
        }

        // Funktion zum Abmelden
        return () => {
            group.members.delete(callback);
        };
    }

    changeDataset(groupId, datasetId) {
        const group = this.groups.get(groupId);

        if (!group) return;

        // Keine unnötigen Aktualisierungen
        if (group.datasetId === datasetId) return;

        group.datasetId = datasetId;

        // Alle verbundenen Komponenten informieren
        for (const callback of group.members) {
            callback(datasetId);
        }
    }
}