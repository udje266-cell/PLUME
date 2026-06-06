/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { User, Story, Comment, Message } from '../types';
import { USERS, INITIAL_STORIES, INITIAL_COMMENTS, INITIAL_MESSAGES } from '../data';

interface DatabaseSchema {
  users: User[];
  stories: Story[];
  comments: Comment[];
  messages: Message[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Initialize the database on disk if not present
function initializeDatabaseOnDisk() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      const defaultData: DatabaseSchema = {
        users: USERS,
        stories: INITIAL_STORIES,
        comments: INITIAL_COMMENTS,
        messages: INITIAL_MESSAGES,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      console.log('[PLUME DB] Base de données initialisée à l\'adresse :', DB_FILE);
    }
  } catch (error) {
    console.error('[PLUME DB] Erreur de création/vérification du fichier DB :', error);
  }
}

// Read database
export function readDb(): DatabaseSchema {
  initializeDatabaseOnDisk();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch (error) {
    console.error('[PLUME DB] Erreur de lecture DB, retour des valeurs par défaut :', error);
    return {
      users: USERS,
      stories: INITIAL_STORIES,
      comments: INITIAL_COMMENTS,
      messages: INITIAL_MESSAGES,
    };
  }
}

// Write database
export function writeDb(data: DatabaseSchema): boolean {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[PLUME DB] Erreur d\'écriture de la base de données :', error);
    return false;
  }
}
