import test from 'node:test';
import assert from 'node:assert/strict';
import {profileList,activeProfileId,inProfile,addProfile,renameProfile,removeProfile,referencesToMigrate,updateProfileDetails,profilePromptNote} from '../extension/lib/profiles.js';

test('existing users get one set, "Set 1", holding all their old photos',() => {
  assert.deepEqual(profileList({}),[{id:'default',name:'Set 1'}]);
  assert.equal(activeProfileId({}),'default');
  const old = [{id:'a',name:'face.jpg'},{id:'b',name:'body.jpg'}];
  assert.deepEqual(inProfile(old,'default').map(r => r.id),['a','b'],'unmigrated photos still count');
  const migrated = referencesToMigrate(old);
  assert.deepEqual(migrated.map(r => r.profileId),['default','default']);
  assert.equal(migrated[0].name,'face.jpg','photo data kept');
  assert.deepEqual(referencesToMigrate(migrated),[],'migration is idempotent');
});

test('new sets are numbered, start unused (they are empty), and only the chosen set\'s photos are used',() => {
  let stored = {};
  stored = {...stored,...addProfile(stored,'p2')};
  assert.deepEqual(stored.profiles.map(p => p.name),['Set 1','Set 2']);
  assert.equal(activeProfileId(stored),'default');
  stored.activeProfile = 'p2';
  const refs = [{id:'a'},{id:'b',profileId:'default'},{id:'c',profileId:'p2'}];
  assert.deepEqual(inProfile(refs,'p2').map(r => r.id),['c']);
  assert.deepEqual(inProfile(refs,'default').map(r => r.id),['a','b']);
  stored = {...stored,...renameProfile(stored,'p2','Set 3')};
  assert.equal(addProfile(stored,'p3').profiles.at(-1).name,'Set 4','skips names already taken');
});

test('rename validates, delete falls back to the first set, which cannot be deleted',() => {
  const stored = {profiles:[{id:'default',name:'Set 1'},{id:'p2',name:'Partner'}],activeProfile:'p2'};
  assert.throws(() => renameProfile(stored,'p2','  '),/name/);
  assert.throws(() => renameProfile(stored,'p2','set 1'),/already/);
  assert.equal(renameProfile(stored,'default','Me').profiles[0].name,'Me');
  assert.deepEqual(removeProfile(stored,'p2'),{profiles:[{id:'default',name:'Set 1'}],activeProfile:'default'});
  assert.throws(() => removeProfile(stored,'default'),/can’t be deleted/);
  assert.equal(activeProfileId({...stored,activeProfile:'gone'}),'default','unknown active set falls back');
});

test('caps the number of sets',() => {
  let stored = {};
  for (let i = 0;i < 7;i++) stored = {...stored,...addProfile(stored,`p${i}`)};
  assert.throws(() => addProfile(stored,'x'),/up to 8/);
});

test('build and sizes are optional, kept per set, and appended to the prompt only when filled',() => {
  let stored = {...addProfile({},'p2')};
  stored = {...stored,...updateProfileDetails(stored,'p2',{build:'  5′10″,   athletic ',sizes:''})};
  const p2 = profileList(stored).find(p => p.id === 'p2');
  assert.deepEqual(p2,{id:'p2',name:'Set 2',build:'5′10″, athletic'});
  assert.equal(profilePromptNote(profileList(stored)[0]),'','nothing added for an empty set');
  const note = profilePromptNote(p2);
  assert.match(note,/^\n\nUSER'S DESCRIPTION/);
  assert.match(note,/- Build: 5′10″, athletic$/);
  assert.doesNotMatch(note,/Sizes/);
  stored = {...stored,...renameProfile(stored,'p2','Partner')};
  assert.equal(profileList(stored)[1].build,'5′10″, athletic','rename keeps details');
  stored = {...stored,...updateProfileDetails(stored,'p2',{build:'',sizes:'M tops'})};
  assert.deepEqual(profileList(stored)[1],{id:'p2',name:'Partner',sizes:'M tops'},'clearing a field removes it');
  assert.equal(updateProfileDetails(stored,'p2',{sizes:'x'.repeat(500)}).profiles[1].sizes.length,200);
});

test('history belongs to the set that made it; older try-ons and cost entries belong to Set 1',() => {
  const records = [{id:'old'},{id:'a',profileId:'default'},{id:'b',profileId:'p2'}];
  assert.deepEqual(inProfile(records,'default').map(r => r.id),['old','a']);
  assert.deepEqual(inProfile(records,'p2').map(r => r.id),['b']);
  assert.deepEqual(inProfile([{id:'x',profileId:null}],'default').map(r => r.id),['x'],'null counts as Set 1');
});
