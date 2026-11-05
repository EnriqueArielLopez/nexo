import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const searchBudget=sqliteTable('search_budget',{id:text('id').primaryKey(),count:integer('count').notNull().default(0),expires:integer('expires').notNull()});
