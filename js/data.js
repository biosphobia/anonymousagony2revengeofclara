/* ============================================================================
 * Anonymous Agony II: Clara's Revenge
 * data.js — content for the grounded, combat-free puzzle/exploration game.
 *   Palette, characters, tiles, four real-world maps, key items, the speaker
 *   portrait map, and the branching story scripts (with the puzzles & twists).
 *
 * Tung Tung Tung Sahur is written as an *oblique symbol* of the harm done to
 * Clara as a child in the first game — never depicted, never sexualized; the
 * story is about a survivor reclaiming her own narrative.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const PAL = {
    black: '#0a0a10', ink: '#e8e8f0', gold: '#e6c84a', blood: '#9a2230',
    grass1: '#27412a', grass2: '#34532f', flower: '#c85a8a', flower2: '#e6c84a'
  };

  const CHARS = {
    clara:    { skin:'#e8c4a0', hair:'#7a2418', style:'long',  shirt:'#2c4a32', pants:'#1c1c24', cape:'#561a1a' },
    haze:     { skin:'#d6b088', hair:'#161618', style:'short', shirt:'#26262e', pants:'#1a1a20', cape:'#3a1414' },
    samson:   { skin:'#d8b890', hair:'#b8bcc4', style:'short', shirt:'#cfd2da', pants:'#33384a' },
    woman:    { skin:'#e3bd97', hair:'#b08030', style:'long',  shirt:'#7a5a8a', pants:'#3a2c3a' },
    child:    { skin:'#e8c4a0', hair:'#5a3a20', style:'short', shirt:'#caa23a', pants:'#3a3a46' },
    annie:    { skin:'#e3bd97', hair:'#4a352a', style:'long',  shirt:'#2f8a8a', pants:'#236a6a' },
    mother:   { skin:'#e0b890', hair:'#6a4a6a', style:'long',  shirt:'#7a4a52', pants:'#3a2c34' },
    father:   { skin:'#cf9e72', hair:'#3a3530', style:'bald',  shirt:'#5a5240', pants:'#2c2a24' },
    enny:     { skin:'#dfe1e6', hair:'#cfc9b8', style:'short', shirt:'#bcd0cf', pants:'#9aa6ad' },
    craig:    { skin:'#d2a878', hair:'#2e2a26', style:'short', shirt:'#28324c', pants:'#1c2334' },
    samsonp:  { skin:'#d8b890', hair:'#b8bcc4', style:'short', shirt:'#cfd2da', pants:'#33384a' },
    tung:     { skin:'#b07d33', hair:'#6e4a1f', style:'hood',  shirt:'#8a5e26', pants:'#5e3f18' }
  };

  // Tile solidity / rendering keys (rendered in graphics.js).
  const SOLID = new Set(['W', 'B', 'o', '#', '^', 'b', 'm', 'P', 'g', ' ', 't', 'C2', 'H', 'K']);
  const TILE_INFO = {};
  function isSolid(ch) { return SOLID.has(ch); }

  // ---- map builder helpers ----
  function grid(w, h, fill) { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(fill)); return g; }
  function set(g, x, y, ch) { if (g[y] && x >= 0 && x < g[y].length) g[y][x] = ch; }
  function rectFill(g, x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, ch); }
  function rectBorder(g, x, y, w, h, ch) { for (let i = x; i < x + w; i++) { set(g, i, y, ch); set(g, i, y + h - 1, ch); } for (let j = y; j < y + h; j++) { set(g, x, j, ch); set(g, x + w - 1, j, ch); } }
  function hLine(g, x, y, len, ch) { for (let i = 0; i < len; i++) set(g, x + i, y, ch); }
  function vLine(g, x, y, len, ch) { for (let i = 0; i < len; i++) set(g, x, y + i, ch); }
  function rows(g) { return g.map(r => r.join('')); }

  // ---------------------------------------------------------------------------
  // MAP — Maple Street (exterior, night). Short. Leads into the house.
  // ---------------------------------------------------------------------------
  function buildStreet() {
    const W = 22, H = 14;
    const g = grid(W, H, '.');
    rectBorder(g, 0, 0, W, H, '^');           // hedges
    rectFill(g, 1, 1, W - 2, 3, 'B');         // the house facade
    rectFill(g, 1, 12, W - 2, 1, 'a');        // road at the very bottom
    vLine(g, 10, 4, 8, ':'); vLine(g, 11, 4, 8, ':'); // path to the door
    set(g, 10, 3, 'D'); set(g, 11, 3, 'D');   // front door (into the house)
    set(g, 5, 7, 'b'); set(g, 16, 7, 'b'); set(g, 17, 9, 'o');
    return {
      id: 'street', name: 'Maple Street', music: 'village', indoor: false,
      w: W, h: H, tiles: rows(g),
      start: { x: 10, y: 10, dir: 'up' },
      exits: [
        { x: 10, y: 3, to: 'house', tx: 11, ty: 16, dir: 'up' },
        { x: 11, y: 3, to: 'house', tx: 12, ty: 16, dir: 'up' }
      ],
      npcs: [ { id: 'neighbor', x: 15, y: 9, dir: 'left', char: 'woman', name: 'Neighbor', script: 'neighbor' } ],
      objects: [
        { id: 'mailbox', x: 8, y: 4, look: 'mailbox' },
        { id: 'car', x: 4, y: 10, look: 'car' }
      ],
      triggers: [ { id: 'intro_street', x: 10, y: 9, once: true, script: 'street_arrive' } ]
    };
  }

  // ---------------------------------------------------------------------------
  // MAP — Inside the house (main exploration hub).
  // ---------------------------------------------------------------------------
  function buildHouse() {
    const W = 24, H = 18;
    const g = grid(W, H, 'f');
    rectBorder(g, 0, 0, W, H, 'W');
    // Clara's old room — enclosed at top-center, single door at the bottom.
    vLine(g, 8, 1, 5, 'W'); vLine(g, 15, 1, 5, 'W');
    hLine(g, 8, 5, 8, 'W'); set(g, 11, 5, 'D'); set(g, 12, 5, 'D');
    // a little rug in the living room
    rectFill(g, 10, 12, 5, 3, 'C');
    // front door
    set(g, 11, 17, 'D'); set(g, 12, 17, 'D');
    return {
      id: 'house', name: 'Home', music: 'house', indoor: true,
      w: W, h: H, tiles: rows(g),
      start: { x: 11, y: 15, dir: 'up' },
      exits: [
        // The front door "won't open" until the memories are faced; then it leads
        // not outside, but to the hospital (the house is a memory — a late twist).
        { x: 11, y: 17, to: 'hospital', tx: 11, ty: 12, dir: 'down', cond: 'clock_set', deny: "It won't open. ...I pull and pull. Why won't it open?" },
        { x: 12, y: 17, to: 'hospital', tx: 12, ty: 12, dir: 'down', cond: 'clock_set', deny: "It won't open. ...I pull and pull. Why won't it open?" },
        // Clara's old room — the climax — opens only after the hospital
        { x: 11, y: 5, to: 'room', tx: 6, ty: 9, dir: 'up', cond: 'hospital_done', deny: "I can't go in there. Not yet. ...That's where it lives." },
        { x: 12, y: 5, to: 'room', tx: 7, ty: 9, dir: 'up', cond: 'hospital_done', deny: "I can't go in there. Not yet. ...That's where it lives." }
      ],
      npcs: [ { id: 'haze', x: 19, y: 3, dir: 'down', char: 'haze', name: 'Haze', script: 'haze' } ],
      objects: [
        { id: 'photo',  x: 5,  y: 1,  look: 'photo' },     // family photo on the north wall
        { id: 'fridge', x: 2,  y: 2,  look: 'fridge' },
        { id: 'ktable', x: 4,  y: 7,  look: 'table' },
        { id: 'laptop', x: 20, y: 3,  look: 'laptop' },     // Haze's desk (top-right)
        { id: 'hbed',   x: 21, y: 1,  look: 'bed' },
        { id: 'couch',  x: 8,  y: 13, look: 'couch' },
        { id: 'tv',     x: 8,  y: 15, look: 'tv' },
        { id: 'clock',  x: 4,  y: 10, look: 'clock' }       // grandfather clock (puzzle)
      ],
      triggers: [ { id: 'house_enter', x: 11, y: 14, once: true, script: 'house_enter' } ]
    };
  }

  // ---------------------------------------------------------------------------
  // MAP — Zede Hospital (memory).
  // ---------------------------------------------------------------------------
  function buildHospital() {
    const W = 24, H = 16;
    const g = grid(W, H, 's');
    rectBorder(g, 0, 0, W, H, 'W');
    rectFill(g, 1, 1, W - 2, 1, 'W');
    // ward beds along the left
    set(g, 11, 14, 'D'); set(g, 12, 14, 'D'); // exit (back to the house)
    rectFill(g, 9, 6, 6, 3, 'C'); // a rug in the middle
    return {
      id: 'hospital', name: 'Zede Hospital', music: 'town', indoor: true,
      w: W, h: H, tiles: rows(g),
      start: { x: 11, y: 13, dir: 'up' },
      exits: [
        { x: 11, y: 14, to: 'house', tx: 11, ty: 15, dir: 'down' },
        { x: 12, y: 14, to: 'house', tx: 12, ty: 15, dir: 'down' }
      ],
      npcs: [
        { id: 'samson', x: 12, y: 5,  dir: 'down', char: 'samson', name: 'Dr. Samson', script: 'samson' },
        { id: 'annie',  x: 4,  y: 8,  dir: 'right', char: 'annie',  name: 'Annie',     script: 'annie' },
        { id: 'enny',   x: 19, y: 9,  dir: 'left',  char: 'enny',   name: 'Enny',      script: 'enny' }
      ],
      objects: [
        { id: 'bed1', x: 2, y: 4, look: 'bed' },
        { id: 'bed2', x: 2, y: 7, look: 'bed' },
        { id: 'window', x: 12, y: 1, look: 'window' }
      ],
      triggers: [ { id: 'hosp_enter', x: 11, y: 12, once: true, script: 'hosp_enter' } ]
    };
  }

  // ---------------------------------------------------------------------------
  // MAP — Clara's childhood room (the climax; grounded, psychological).
  // ---------------------------------------------------------------------------
  function buildRoom() {
    const W = 14, H = 12;
    const g = grid(W, H, 'f');
    rectBorder(g, 0, 0, W, H, 'W');
    set(g, 6, 11, 'D'); set(g, 7, 11, 'D'); // door back to house
    return {
      id: 'room', name: '...', music: 'room', indoor: true,
      w: W, h: H, tiles: rows(g),
      start: { x: 6, y: 9, dir: 'up' },
      exits: [
        { x: 6, y: 11, to: 'house', tx: 11, ty: 6, dir: 'down' },
        { x: 7, y: 11, to: 'house', tx: 12, ty: 6, dir: 'down' }
      ],
      npcs: [ { id: 'tung', x: 6, y: 3, dir: 'down', char: 'tung', name: 'Tung Tung Tung Sahur', script: 'tung' } ],
      objects: [
        { id: 'cbed', x: 2, y: 2, look: 'bed' },
        { id: 'cwindow', x: 7, y: 1, look: 'window' }
      ],
      triggers: [ { id: 'room_enter', x: 6, y: 8, once: true, script: 'room_enter' } ]
    };
  }

  const MAPS = {
    street: buildStreet(),
    house: buildHouse(),
    hospital: buildHospital(),
    room: buildRoom()
  };

  // ---- Key items (no combat; puzzle/flavor only) ----
  const ITEMS = {
    haze_note: { name: "Haze's Note", kind: 'key', desc: "Scrawled fast: '3 AM. when it always happens. don't let it in this time. -A'" }
  };

  const SPEAKER_PORTRAITS = {
    'Clara': 'clara', 'Haze': 'haze', 'Dr. Samson': 'samson', 'Mother': 'mother', 'Father': 'father',
    'Annie': 'annie', 'Enny': 'enny', 'Officer Craig': 'craig', 'Craig': 'craig',
    'Tung Tung Tung Sahur': 'tung', 'Neighbor': 'woman', '???': null
  };

  // ---------------------------------------------------------------------------
  // Scripts. Each is fn(ctx, obj) -> [events].  ctx = {flags, items, hasItem}.
  // Branch freely in JS on ctx.flags / ctx.hasItem.
  // ---------------------------------------------------------------------------
  const S = {
    // ---- street ----
    street_arrive: () => ([
      { say: 'Clara', text: "...The old house on Maple Street. I swore I'd burn it down before I ever set foot here again." },
      { say: 'Clara', text: "But the knocking doesn't stop. Not for years. Not for screaming into a pillow. ...Fine. We do this the hard way." },
      { say: null, text: "(Go through the front door.)" }
    ]),
    neighbor: (ctx) => ctx.flags.tung_done ? [
      { say: 'Neighbor', text: "You've been standing on that lawn for hours, hon. ...You okay? You look like you finally slept." }
    ] : [
      { say: 'Neighbor', text: "Nobody's lived in that house for years, sweetheart. Not since... well. You know what happened to that family." },
      { say: 'Clara', text: "...Yeah. I know exactly what happened to that family." }
    ],
    mailbox: () => ([ { say: null, text: "Rusted shut. A wasp nest where the letters used to go. Nobody writes to ghosts." } ]),
    car: () => ([ { say: null, text: "Dad's old car. Four flat tires. It never took us anywhere good anyway." } ]),

    // ---- house ----
    house_enter: () => ([
      { say: null, text: "The door clicks shut behind you. The air is thick, like a held breath." },
      { say: 'Clara', text: "It's exactly how it was. Down to the dust. That's... not possible." },
      { say: null, text: "(Look around. The family photo, the laptop, the clock. And Haze is in his room.)" }
    ]),
    haze: (ctx) => {
      if (ctx.flags.haze_truth) return [
        { say: 'Haze', text: "...You know now. So you know I can't really be here, twerp." },
        { say: 'Haze', text: "Doesn't mean I won't stand in the doorway while you do it. Old habits. Go on. Finish it." }
      ];
      if (ctx.flags.note_taken) return [
        { say: 'Haze', text: "3 AM. The clock in the hall. You always were slow on the easy stuff, genius." }
      ];
      return [
        { say: 'Haze', text: "Took you long enough. Sit down, don't sit down, I don't care. ...You look like hell, by the way." },
        { say: 'Clara', text: "Hi to you too, Ass. ...God, I missed your stupid face." },
        { say: 'Haze', text: "Sap. Listen — this place isn't safe and you know why. I left you something. I always leave you something." },
        { say: 'Haze', text: "Snarky little warnings. 'Cause saying it straight was never my thing. Take the note. Then face the rest." },
        { give: 'haze_note' },
        { setFlag: 'note_taken', value: true },
        { say: null, text: "(Got Haze's Note. Examine the family photo and the laptop, then the hall clock.)" }
      ];
    },
    photo: (ctx) => {
      if (ctx.flags.photo_seen) return [ { say: null, text: "Four people who never once smiled at the same time. And the boy with his arm around the littlest one." } ];
      return [
        { say: null, text: "A family photo. Mom and Dad, already looking past each other." },
        { say: 'Clara', text: "And there's Haze. Eighteen and furious at the whole world. Except when he looked at me." },
        { say: 'Clara', text: "He was the only one who ever actually saw me. ...Before everything." },
        { setFlag: 'photo_seen', value: true }
      ];
    },
    laptop: (ctx) => {
      if (ctx.flags.laptop_seen) return [ { say: null, text: "The screen still glows. A chat window with someone who was never really my friend." } ];
      return [
        { say: null, text: "My old laptop. Still logged in. The chat window blinks awake on its own." },
        { say: 'Tung Tung Tung Sahur', text: "tung tung tung~ ciao bambina! you remember me? tralalero tralala, your bestest friend from the screen!" },
        { say: 'Tung Tung Tung Sahur', text: "so nice, so patient, so many secrets we keep, no? bombardiro crocodilo... open the door for me, piccolina, you always do~" },
        { say: 'Clara', text: "...You were never a friend. You were a grown man with a clown's voice and a kid's screen name rotting in your teeth." },
        { say: 'Clara', text: "And I was eleven, you son of a bitch." },
        { setFlag: 'laptop_seen', value: true }
      ];
    },
    fridge: () => ([ { say: null, text: "Empty except for a calendar magnet. Every day after that one is crossed out in the same red pen." } ]),
    table: () => ([ { say: null, text: "Two chairs pulled out, two pushed in. We stopped eating as a family long before it all fell apart." } ]),
    couch: () => ([ { say: null, text: "Where Haze taught me every co-op level twice because I 'wasn't allowed to lose.'" } ]),
    tv: () => ([ { say: null, text: "Dead static. If you stare long enough you can almost see cartoons. Almost." } ]),
    bed: () => ([ { say: null, text: "Made with hospital corners. Some habits you never lose." } ]),
    window: () => ([ { say: null, text: "Outside it's that exact shade of almost-dawn. The sky never quite turns over." } ]),

    clock: (ctx) => {
      if (ctx.flags.clock_set) return [ { say: null, text: "3:00. It stays at 3:00 now. The hour everything stops." } ];
      if (!(ctx.flags.photo_seen && ctx.flags.laptop_seen && ctx.flags.note_taken)) return [
        { say: 'Clara', text: "My head's too loud to think. The photo. The laptop. Haze's note. ...I have to look at all of it first." }
      ];
      const h = ((ctx.flags.clock_h || 12) % 12) + 1;        // 1..12
      const evs = [
        { setFlag: 'clock_h', value: h },
        { sfx: 'knock' },
        { say: null, text: "You move the hour hand. It reads " + h + ":00." }
      ];
      if (h === 3) {
        evs.push({ setFlag: 'clock_set', value: true });
        evs.push({ say: 'Clara', text: "3 AM. That's the hour the knocking always came. ...Okay. Now the front door will open. I can feel it." });
        evs.push({ say: null, text: "(The front door is open now. ...But it doesn't lead where you think.)" });
      }
      return evs;
    },

    // ---- hospital ----
    hosp_enter: () => ([
      { say: null, text: "The front door didn't open onto the street. It opened onto a hallway that smells like antiseptic and crayons." },
      { say: 'Clara', text: "Zede Hospital. ...The door from my house leads to the HOSPITAL. That's when I should have known." }
    ]),
    samson: (ctx) => {
      if (ctx.flags.hospital_done) return [
        { say: 'Dr. Samson', text: "You're nearly there, Clara. The last room is yours, and yours alone. I'll be right here when you come back out." }
      ];
      return [
        { say: 'Dr. Samson', text: "Hello, Clara. Take your time. You built all this — the house, the street, every dustmote. I only taught you how." },
        { say: 'Clara', text: "...Built it? What do you—" },
        { say: 'Dr. Samson', text: "A memory house. We walk through the worst day on purpose, room by room, until it can't ambush you anymore. You've been doing the work for years." },
        { say: 'Clara', text: "Then why does it still feel like he's right behind me?" },
        { say: 'Dr. Samson', text: "Because you keep leaving one room locked. You know the one. ...Talk to Annie. Talk to Enny. Then go open it." },
        { setFlag: 'samson_told', value: true }
      ];
    },
    annie: (ctx) => ctx.flags.haze_truth ? [
      { say: 'Annie', text: "He loved you more than his own life, that brother of yours. In the end, that's exactly what it cost." }
    ] : [
      { say: 'Annie', text: "I'm Annie. I held the bucket while the good doctor broke every rule in this building to keep you alive." },
      { say: 'Annie', text: "...There's something nobody told you straight, sweetheart. About Haze. You should hear it before that last room." },
      { say: 'Annie', text: "After they took him for what he did to those men — the ones who hurt children — he never came up for trial." },
      { say: 'Clara', text: "...What do you mean he never—" },
      { say: 'Annie', text: "He died in that cell, Clara. Two winters ago. The Haze in your house is the only place he gets to keep living." },
      { say: 'Clara', text: "...no. no no no. ...He was WAITING for me in there. He gave me a NOTE—" },
      { say: 'Annie', text: "He gave you a hundred notes, hon. You memorized every one. That's grief. That's love. That's not a ghost." },
      { setFlag: 'haze_truth', value: true }
    ],
    enny: (ctx) => ctx.flags.haze_truth ? [
      { say: 'Enny', text: "You can do the scary room, Clara! We practiced being brave, remember? No take-backs!" },
      { setFlag: 'hospital_done', value: true },
      { say: null, text: "(You feel ready. Go home — and open your old room.)" }
    ] : [
      { say: 'Enny', text: "Clara! Clara! It's me, Enny, your bestest friend that isn't a screen-liar! ...Talk to Annie first, okay? She's got the sad part." }
    ],

    // ---- the room (climax) ----
    room_enter: () => ([
      { say: null, text: "Your old bedroom. Eleven years old forever. And in the corner, where the nightlight never reached..." },
      { say: 'Clara', text: "...There you are. I've been walking toward this door my whole life." }
    ]),
    tung: (ctx) => {
      if (ctx.flags.tung_done) return [ { say: null, text: "The corner is just a corner now. Morning light, and dust. Nothing else." } ];
      return [
        { say: 'Tung Tung Tung Sahur', text: "tung... tung... tung... sahuuur~ little Clara came home! tralalero tralala, did you bring me secrets?" },
        { say: 'Tung Tung Tung Sahur', text: "remember our game? you no tell, I no tell, bombardiro crocodilo! it was YOUR fault for opening the door, si? always your fault~" },
        { say: 'Clara', text: "That's the trick, isn't it. The dumb little voice. The clown noises. You made it sound like a game so I'd think I chose it." },
        { choice: "He's waiting. What does Clara say?", who: 'Clara', options: [
          { label: "\"It was my fault. I let you in.\"", events: [
            { say: 'Tung Tung Tung Sahur', text: "siii! brava! tung tung tung, good girl, you keep the blame, you keep ME~" },
            { say: 'Clara', text: "...No. That's YOUR line. I'm done reciting your lines." }
          ] },
          { label: "\"You're not real. You never were.\"", events: [
            { say: 'Tung Tung Tung Sahur', text: "not real? tralalero... then why you still flinch at the knock-knock-knock, eh, eh?" },
            { say: 'Clara', text: "Because being scared isn't the same as being guilty. I know the difference now." }
          ] },
          { label: "\"I was eleven. It was never my fault.\"", events: [ { setFlag: 'named_it', value: true } ] }
        ] },
        // loop until she names it
        { goto: 'tung_climax' }
      ];
    },
    tung_climax: (ctx) => {
      if (!ctx.flags.named_it) return [
        { say: 'Tung Tung Tung Sahur', text: "tung tung tung~ say it again, say it MY way, piccolina~" },
        { choice: "Say it again.", who: 'Clara', options: [
          { label: "\"...It was my fault.\"", events: [ { say: 'Clara', text: "...no. No. I don't believe that anymore. I won't." } ] },
          { label: "\"I was eleven. It was NEVER my fault.\"", events: [ { setFlag: 'named_it', value: true } ] }
        ] },
        { goto: 'tung_climax' }
      ];
      return [
        { say: 'Clara', text: "I was ELEVEN. You were the grown-up. You were the predator. The shame was always yours — I just hauled it around for twelve years because I was small and you were heavy." },
        { say: 'Clara', text: "Haze made sure you and every animal like you got buried where you couldn't crawl back out. It cost him his whole life. I am NOT wasting that flinching at a wooden clown." },
        { say: 'Tung Tung Tung Sahur', text: "t-tung...? tralale...ro...? bambina, no, we have a GAME, we have a—" },
        { say: 'Clara', text: "Game's over. Get the hell out of my head." },
        { sfx: 'knock' }, { flash: '#ffffff', dur: 700 }, { shake: 6, dur: 800 },
        { setFlag: 'tung_done', value: true },
        { ending: true }
      ];
    },

    ending: () => ([
      { fade: 'out', dur: 1400 },
      { narrate: ["The knocking stopped.", "Not because something was beaten —", "because she finally stopped answering for it."] },
      { narrate: ["She opened the curtains she'd kept shut for years.", "The almost-dawn finally tipped over into morning.", "Real morning. The first one in a long time."] },
      { narrate: ["Haze wasn't there. Haze hadn't been there for two winters.", "But what he did — refusing to let the world look away —", "had walked her all the way here."] },
      { narrate: ["Clara Stratos was twenty-three years old.", "She was a survivor. Not a secret. Not a fault. Not a game.", "", "And for the first time, the quiet was just quiet."] },
      { narrate: ["ANONYMOUS AGONY II", "Clara's Revenge", "", "— for everyone still standing on the lawn,", "working up the nerve to go in."] },
      { credits: true }
    ])
  };

  const DATA = {
    PAL, CHARS, TILE_INFO, MAPS, ITEMS, SPEAKER_PORTRAITS, SCRIPTS: S, isSolid,
    TILE: 16, VIEW_W: 16, VIEW_H: 12
  };
  global.DATA = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
