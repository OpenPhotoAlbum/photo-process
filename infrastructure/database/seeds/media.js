/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('media').del()
  await knex('media').insert([
    {id: 1, path: '/fam/2025-05-17_15-06-48_IMG_9231.JPG'},
    {id: 2, path: '/fam/2023-04-02_10-40-03_795bf7aa-72bc-4971-8c89-08774f95e1f0.jpg'},
    {id: 3, path: '/fam/family.jpg'},
  ]);
};
