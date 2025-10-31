import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserData } from '../App';

export interface AuditLog {
    id?: string;
    timestamp: any; // Firestore Timestamp
    actorId: string;
    actorName: string;
    action: string;
    target: {
        type: string;
        id: string;
        name: string;
    };
    details?: { [key: string]: any };
}

/**
 * Logs an action to the AuditLogs collection in Firestore.
 * @param actor - The user performing the action.
 * @param action - A string describing the action (e.g., 'USER_CREATE').
 * @param target - An object describing the entity that was acted upon.
 * @param details - Optional additional details about the action.
 */
export const logAction = async (
    actor: UserData,
    action: string,
    target: { type: string; id: string; name: string },
    details?: { [key: string]: any }
): Promise<void> => {
    try {
        if (!actor || !actor.id || !actor.name) {
            console.error("Audit log failed: Invalid actor data provided.", { actor });
            return;
        }

        const logEntry: Omit<AuditLog, 'id'> = {
            timestamp: serverTimestamp(),
            actorId: actor.id,
            actorName: actor.name,
            action,
            target,
            details: details || {},
        };

        await addDoc(collection(db, 'AuditLogs'), logEntry);
    } catch (error) {
        console.error("Failed to write to audit log:", error);
        // In a real application, you might want to handle this more gracefully,
        // maybe by queuing the log and retrying later.
    }
};
