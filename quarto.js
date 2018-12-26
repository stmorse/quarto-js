/////
// GLOBAL VARS
/////

var canvas;

var gridsize = 50;
var offset = 5;     // space at edge of boards

// absolute positioning (modify for mobile?)
var pool_x0 = 0;
var pool_y0 = 0;
var pool_width = pool_height = gridsize*4 + offset*2;
var limbo_x0 = pool_x0 + pool_width + offset;
var limbo_y0 = gridsize + offset + 15;
var limbo_width = limbo_height = gridsize + offset*2;
var board_x0 = pool_x0 + pool_width + offset + limbo_width + offset;
var board_y0 = 0;
var board_width = board_height = gridsize*4 + offset*2;

// piece globals
var numpieces = 16;
var pieces = [];
var curunit = -1;
var oldlimbo = -1;
var newlimbo = -1;
var playspot = -1;
var firstTurn = true;

// phase globals
var USER_TURN = 0,
    COMP_TURN = 1;
var phase = USER_TURN;

// piece to board grid assignments -> board[row][col]
var board = [];
for (i=0; i<16; i++) {
  board[i] = 16;
}

// piece to pool assignments -> pool[row][col]
var pool = [];
for (i=0; i<16; i++) {
  pool[i] = 16;
}


/////
// MOVEMENT HANDLING
/////

// TODO:  This whole absolute positioning system is clunky and awful

function absToGrid(ax, ay) {
	if (ax < pool_width) {
		ax = Math.floor(ax / gridsize);
		ay = Math.floor(ay / gridsize);
	} else if (ax > board_x0) {
		ax = ax - board_x0;
		ax = Math.floor(ax / gridsize);
		ay = Math.floor(ay / gridsize);
	} else {
    // in limbo, no grid
		return -1;
	}
  // convert ax, ay to single index
  var idx = (ay * 4) + ax;
	return idx;
}

function inBoard(u) {
  for (i=0; i<16; i++) {
    if (board[i] == u) {
      return true;
    }
  }
  return false;
}

function inPool(u) {
  for (i=0; i<16; i++) {
    if (pool[i] == u) {
      return true;
    }
  }
  return false;
}

//
// modify for mobile ?
//
function xyinPool(ax, ay) {
  if (ax < pool_width) {
    return true;
  } 
  return false;
}
function xyinBoard(ax, ay) {
  if (ax > board_x0) {
    return true;
  }
  return false;
}
function xyinLimbo(ax, ay) {
  if (ax > pool_width && ax < board_x0) {
    return true;
  }
  return false;
}


function checkValidMove(ax, ay) {
  // move must be:
  // in place (not overlapping)
  // oldlimbo <--> board
  // pool <--> newlimbo

  if (curunit == oldlimbo || inBoard(curunit)) {
    if (xyinLimbo(ax,ay)) {
      return true;
    } else if (xyinBoard(ax,ay)) {
      bgrid = absToGrid(ax, ay);
      if (board[bgrid] == 16 && curunit == oldlimbo) {
        return true;
      }
    } 
    return false;
  } else if (curunit == newlimbo || inPool(curunit)) {
    if (xyinLimbo(ax,ay)) {
      return true;
    } else if (xyinPool(ax,ay)) {
      pgrid = absToGrid(ax, ay);
      if (pool[pgrid] == 16) {
        return true;
      }
    }
    return false;
  } else {
    console.log('Unrecognized condition.');
  }
}


function handleMove(idx, ox, oy, nx, ny) {
  // we already checked move was valid so just do it
  // should we add error checking??

  var wasPool = false;
  var wasBoard = false;
  var wasNewLimbo = false;
  var wasOldLimbo = false;

  // console.log('handleMove BEFORE: cur %d old %d new %d', curunit, oldlimbo, newlimbo);

  // handle current location changes
  if (ox < pool_width) {
    // drop from pool
    for (i=0; i<16; i++) {
      if (pool[i] == idx) {
        pool[i] = 16;
        wasPool = true;
        break;
      }
    }
  } else if (ox > board_x0) {
    // drop from board
    for (i=0; i<16; i++) {
      if (board[i] == idx) {
        board[i] = 16;
        wasBoard = true;
      }
    }
  } else {
    // drop from limbo
    if (idx == newlimbo) {
      wasNewLimbo = true;
      newlimbo = -1;
    } else if (idx == oldlimbo) {
      wasOldLimbo = true;
      // oldlimbo = -1;
    } else {
      console.log(' Unrecognized status for %d', idx);
    }
  }

  // handle new location changes
  g = absToGrid(nx, ny);
  if (nx < pool_width) {
    // add to pool
    pool[g] = idx;
  } else if (nx > board_x0) {
    // add to board
    board[g] = idx;
    playspot = g;
  } else {
    // add to limbo
    // if coming to limbo, must have been from 
    // pool -> new, new -> new, or board -> old, old -> old
    if (wasPool || wasNewLimbo) {
      newlimbo = idx;
    } else if (wasBoard || wasOldLimbo) {
      oldlimbo = idx;
      playspot = -1;
    } else {
      console.log('Unrecognized location for %d', idx);
    }
  }

  // console.log('handleMove AFTER: cur %d old %d new %d', curunit, oldlimbo, newlimbo);
}


/////
// GAME AI
/////

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function comparePieces(p1,p2,p3,p4) {
  // returns attribute that made the first found quarto
  
  var tot = 0;
  
  // loop on type
  for (var j=0;j<4;j++) {
      tot = ((p1 & (1<<j))>>j) + ((p2 & (1<<j))>>j) + ((p3 & (1<<j))>>j) + ((p4 & (1<<j))>>j) ;
      if (tot==4 || tot==0) {
          return j;
      }
      tot = 0;
  }
  
  return 4;
}

function hasQuarto(tboard, spot) {
  // check if a test board has a quarto at this spot

  // check for empty pieces in row or col
  var checkRow = true;
  var checkCol = true;
  
  var rowhead = spot - (spot%4);
  var colhead = spot%4;
  
  var r1 = tboard[rowhead],   r2 = tboard[rowhead+1], 
      r3 = tboard[rowhead+2], r4 = tboard[rowhead+3];
  var c1 = tboard[colhead],   c2 = tboard[colhead+4],
      c3 = tboard[colhead+8], c4 = tboard[colhead+12];
  
  // check for empty spots in row or col
  if ( r1==16 || r2==16 ||
       r3==16 || r4==16 ) {
    checkRow = false;
  } 
  if ( c1==16 || c2==16 ||
       c3==16 || c4==16 ) {
    checkCol = false;
  }
  if ( !checkRow && !checkCol ) {
    return false;
  }
  
  // no empty spots, start comparing pieces in row and col
  var result;
  
  // check rows
  if (checkRow) {
    result = comparePieces(r1,r2,r3,r4);
    if (result < 4) {
      return true;
    }
  }

  // check columns
  if (checkCol) {
    result = comparePieces(c1,c2,c3,c4);
    if (result < 4) {
      return true;
    }
  }    
  
  // nothing found
  return false;
}

function getRemainingSpots(tboard) {
  var rs = []
  var m = 0
  for (i=0; i<16; i++) {
    if (tboard[i] == 16) {
      rs[m] = i;
      m++;
    }
  }
  return rs;
}

function getRemainingPieces(tpool) {
  var rp = [];
  var m = 0;
  for (i=0; i<16; i++) {
    if (tpool[i] != 16) {
      rp[m] = tpool[i];
      m++;
    }
  }
  return rp;
}


///////
// MINIMAX FUNCTIONS


function QNode(s, p, pl) {
  this.spot = s;
  this.pp = p;
  this.player = pl;
  this.children = [];
  this.isLeaf = true;
  this.isQuarto = false;

  this.addChild = function( node ) {
    this.children.push( node );
    this.isLeaf = false;
  }

  this.getString = function() {
    var str = "<" + this.spot + "," + this.pp + "," + this.player;
    if (this.isQuarto)
        str += ",Q!";
    str += ">";
    return str;
  }
}

function buildTree(passedPiece, spot, nextPiece, boardstate, poolstate, player, depth ) {
  var node    = new QNode( spot, nextPiece, player );
  var cboard  = boardstate.slice();
  var cpool   = poolstate.slice();
  var d       = depth;
  var remspots, rempieces;

  // play to spot
  cboard[spot] = passedPiece;
  
  if (hasQuarto(cboard, spot)) {
    node.isLeaf = true;
    node.isQuarto = true;
    return node;
  }
  
  // check if this is a leaf before we continue
  if (nextPiece==16) {
    node.isLeaf = true;
    return node;
  }
  
  if (depth == 0) {
    // we have reached desired depth
    node.isLeaf = true;
    return node;
  }
  
  // begin to build child nodes...

  // "pass" the piece
  for (p=0;p<16;p++){
    if (cpool[p]==nextPiece) {
      cpool[p] = 16;    
    }
  }
  
  tremspots  = getRemainingSpots(cboard);
  trempieces = getRemainingPieces(cboard);
  
  for (p=0;p<tremspots.length;p++) {
    if (trempieces.length>0) {
      for (q=0;q<trempieces.length;q++) {
          node.addChild( buildTree( nextPiece, tremspots[p], trempieces[q], 
            cboard, cpool, (player==COMP_TURN) ? USER_TURN : COMP_TURN, d-1 )); 
      }
    }
    else {  // no pieces left = leaf node, use a placeholder for nextPiece
      node.addChild( buildTree( nextPiece, tremspots[p], 16, 
        cboard, cpool, (player==COMP_TURN) ? USER_TURN : COMP_TURN, d-1 ));
    }
  }
  
  return node;
}

function computeMiniMax( node ) {
  if (node.isLeaf) {
      if ( node.isQuarto)
          return (node.player==COMP_TURN) ? 1 : -1;
      else
          return 0;
  }
  
  var tans = 0, ans = 0;
  for (ci=0;ci<node.children.length;ci++) {
    tans = computeMiniMax( node.children[ci] );
    if ( node.player == COMP_TURN ) {
      ans = Math.min( ans, tans );
    }
    else {
      ans = Math.max( ans, tans );
    }
  }
  
  return ans;
}

function displayTree( root ) {
  // returns decision tree in String form
  
  var str = "";
  
  str += root.getString();

  if (!root.isLeaf) {
      str += "-(";
      for (y=0;y<root.children.length;y++) {
        str += root.children[y].getString();
        // str += displayTree( ci );
      }
      str += ")";
  }
  
  return str;
} 


function getMinimaxMove(depth) {
  var debug = true;

  // root node array of QNodes
  var rootnodes = [];
  
  // build tree
  var remspots  = getRemainingSpots(board);
  var rempieces = getRemainingPieces(pool);
  var passedPiece = oldlimbo;
  var m = 0;
  console.log("getMinimaxMove... remspots %d rempieces %d", remspots.length, rempieces.length);
  for (a=0;a<remspots.length;a++) {
    for (b=0;b<rempieces.length;b++) {
      rootnodes.push(buildTree( passedPiece, remspots[a], rempieces[b], board, pool, COMP_TURN, depth ));
      m++;
    }
  }
  
  // display tree (debug)
  if (debug) {
    for (k=0;k<m;k++) {
      // console.log( " ROOT: %s", rootnodes[k].getString());
      console.log( " ROOT (%d ch): %s", rootnodes[k].children.length, displayTree( rootnodes[k] ) );
    }
  }
  
  // compute minimax
  if (debug) { console.log( " Computing minimax: " ); }
  var outcomes = [];
  var res = 0;
  
  for (x=0;x<m;x++) {
    outcomes.push(computeMiniMax(rootnodes[x]));
    
    if (debug) {
      console.log( rootnodes[x].getString() + "=" + outcomes[x] + ((x<(m-1)) ? "," : " ") );
    }
    
    // continues to upgrade, otherwise keeps res=0
    if (x>0 && outcomes[x] > outcomes[res]) {
        res = x;
    }
  }
  
  return [rootnodes[res].spot, rootnodes[res].pp];
}


////////////


function getSimpleMove() {
  // checks for any one-move quarto plays
  // pass a random piece (improve?)
  // stores in result as [spotrow, spotcol, pieceidx]

  var result = []

  var remspots = getRemainingSpots(board);
  for (i=0; i<remspots.length; i++) {
    // test oldlimbo in this spot
    var tboard = board.slice();  // clone board into tboard
    // var tboard = clone(board);
    var rs = remspots[i];
    tboard[rs] = oldlimbo;
    if (hasQuarto(tboard, rs)) {
      result[0] = rs;
      break;
    }
  }
  if (result.length == 0) {
    // no winners, pick at random
    var rs = remspots[getRandomInt(0, remspots.length-1)];
    result[0] = rs;
  }

  var rempieces = getRemainingPieces(pool);
  result[1] = rempieces[getRandomInt(0, rempieces.length-1)];

  return result;
}


//////
// BASE COMPUTER SWITCHBOARD

function doComputerMove() {
  var numspots = getRemainingSpots(board).length;

  // getMinimaxMove(depth)
  // depth = 0 : similar to SimpleMove
  // depth = 1 : makes sure not passing a winner to user
  // depth = 2 : looks for win after user passes back
  if (numspots > 14) {
    res = getSimpleMove();  
  } else if (numspots <= 14 && numspots > 9) {
    res = getMinimaxMove(2);
  } else {
    res = getMinimaxMove(4);
  }
  
  console.log('res:', res);

  // implement board move result
  var gx = res[0] % 4;
  var gy = Math.floor(res[0] / 4);
  var nx = gx * gridsize + board_x0 + offset;
  var ny = gy * gridsize + offset;
  pieces[oldlimbo].animate({
    left: ((oldlimbo & SHORT) == 0) ? nx+poffset_lg : nx+poffset_sm,
    top: ((oldlimbo & SHORT) == 0) ? ny+poffset_lg : ny+poffset_sm
  }, {
    onChange: canvas.renderAll.bind(canvas),
    duration: 400,
    easing: fabric.util.ease.easeOutCubic
  });
  // have to do handleMove last because it will change oldlimbo status
  handleMove(oldlimbo, pieces[oldlimbo].get('left'), pieces[oldlimbo].get('top'),
    nx, ny);

  // implement new limbo result
  var nx = limbo_x0+offset, ny = limbo_y0+offset;
  handleMove(res[1], pieces[res[1]].get('left'), pieces[res[1]].get('top'),
    nx, ny);
  pieces[res[1]].animate({
    left: ((res[1] & SHORT) == 0) ? nx+poffset_lg : nx+poffset_sm,
    top: ((res[1] & SHORT) == 0) ? ny+poffset_lg : ny+poffset_sm
  }, {
    onChange: canvas.renderAll.bind(canvas),
    duration: 400,
    easing: fabric.util.ease.easeOutCubic
  });
}


/////
// MAIN
/////

// initialize piece images and locations

// structure:
// COLOR  HEIGHT SHAPE SOLIDITY
//   2^3   2^2   2^1   2^0
//   B/W   T/S   Q/C   D/H
//   0/1   0/1   0/1   0/1

var poffset_lg = 4;   // distance from top left of square
var poffset_sm = 10;
var hstroke = 6;      // thickness of stroke for hollow pieces
// var color1 = '#f00';
// var color2 = '#00f';
var color1 = '#778899';  // light slate gray
var color2 = '#998877';  // some red/brown ?

var WHITE = 8, SHORT = 4, CIRCLE = 2, HOLLOW = 1;

for (i=0; i<numpieces; i++) {
  var row = Math.floor(i / 4);
  var col = i % 4;
  
  pool[i] = i;

  // shape
  // if (col == 0 || col == 1) {
  if ((i & CIRCLE) == 0) {
    pieces[i] = new fabric.Rect();
  } else {
    pieces[i] = new fabric.Circle();
  }

  // size
  // if (row % 2 == 0) {
  if ((i & SHORT) == 0) {
    // LARGE
    pieces[i].set({
      top: row * gridsize + offset + poffset_lg,
      left: col * gridsize + offset + poffset_lg
    });
    if ((i & HOLLOW) == 0) {
      // large and dense
      pieces[i].set({
        width: gridsize - poffset_lg * 2,
        height: gridsize - poffset_lg * 2,
        radius: (gridsize / 2) - poffset_lg
      });  
    } else {
      // large and hollow
      pieces[i].set({
        width: gridsize - (poffset_lg * 2) - hstroke,
        height: gridsize - (poffset_lg * 2) - hstroke,
        radius: (gridsize / 2) - poffset_lg - (hstroke / 2)
      });
    }
  } else {
    // SMALL
    pieces[i].set({
      top: row * gridsize + offset + poffset_sm,
      left: col * gridsize + offset + poffset_sm
    })
    if ((i & HOLLOW) == 0) {
      // small and dense
      pieces[i].set({
        width: gridsize - (poffset_sm * 2),
        height: gridsize - (poffset_sm * 2),
        radius: (gridsize / 2) - poffset_sm
      });
    } else {
      // small and hollow
      pieces[i].set({
        width: gridsize - (poffset_sm * 2) - hstroke,
        height: gridsize - (poffset_sm * 2) - hstroke,
        radius: (gridsize / 2) - poffset_sm - (hstroke / 2)
      });
    }
  }

  // density and color
  if ((i & HOLLOW) == 0) {
    // dense
    pieces[i].set({
      fill: (i < 8) ? color1 : color2,
    });
  } else {
    // hollow
    pieces[i].set({
      fill: 'transparent',
      stroke: (i < 8) ? color1 : color2,
      strokeWidth: hstroke
    });
  }

  pieces[i].set({id: i});
  pieces[i].hasControls = false;  
}



$(document).ready(function () {
  /////
  // UI SETUP
  ////

  // set css elements
  $('.infobar').css({
    top: pool_height + offset, left: offset*3,
    height: 30, width: pool_width+board_width
  });
  // $('.button').css({top: pool_height + offset, width: 100});
  $('#endturn').css({
    top: limbo_y0+limbo_height+(2*offset),
    left: limbo_x0 + ((limbo_width - limbo_width/1.25)/2),
    width: limbo_width / 1.25,
    height: limbo_height / 2
  });

  canvas = new fabric.Canvas('c', { selection: false });
  canvas.setHeight(pool_height + 20);
	canvas.setWidth(board_x0 + board_width + 40);
  
  // create background
  var pool_rect = new fabric.Rect({
    left: pool_x0, top: pool_y0,
    width: pool_width, height: pool_height,
    selectable: false, fill: 'rgba(0,0,0,0)',
    stroke: 'black'
  });
  var limbo_rect = new fabric.Rect({
  	left: limbo_x0, top: limbo_y0,
  	width: limbo_width, height: limbo_height,
  	selectable: false, fill: 'rgba(0,0,0,0)',
  	stroke: 'black'
  });
  var board_rect = new fabric.Rect({
    left: board_x0, top: board_y0,
    width: board_width, height: board_height,
    selectable: false, fill: 'rgba(0,0,0,0)',
    stroke: 'black'
  });
  var board_grid_path = 'M 0 0 H 200 V 200 H 0 V 0 Z \
                         M 0 50 H 200 Z M 0 100 H 200 M 0 150 H 200 Z \
                         M 50 0 V 200 Z M 100 0 V 200 Z M 150 0 V 200 Z'
  var board_grid_img = new fabric.Path(board_grid_path);
  board_grid_img.set({
    top: board_y0 + offset, left: board_x0 + offset,
    stroke: 'rgba(10,10,10,0.3)', selectable: false,
    fill: 'transparent'
  });
  canvas.add(pool_rect);
  canvas.add(limbo_rect);
  canvas.add(board_rect);
  canvas.add(board_grid_img);

  // add objects
  for (i=0; i<numpieces; i++) {
    canvas.add(pieces[i]);
  }


  /////
  // PLAY/PASS HANDLING
  /////

  $('#endturn').click(function() {
    // at end turn, need newlimbo and oldlimbo == -1

    if (!firstTurn && hasQuarto(board, playspot)) {
      // do some animation

      if (phase == USER_TURN) {
        $('#info').text('YOU MADE A QUARTO!');  
      } else {
        $('#info').text('THE COMPUTER MADE A QUARTO! (YOU LOSE)');  
      }

      // turn off all actions
      return;
    }

    if (newlimbo == -1) {
      $('#info').text('Place a piece in limbo.')
      setTimeout(function () {
        $('#info').text('')}, 2000);
      
      // animation to remind the user what to do
      var zoomrect = new fabric.Rect({
        left: limbo_x0 - 100, top: limbo_y0 - 100,
        width: limbo_width + 200, height: limbo_height + 200,
        fill: 'transparent', stroke: 'rgba(200,50,50,0.5)', strokeWidth: 8
      });
      canvas.add(zoomrect)
      zoomrect.animate({
        left: limbo_x0, top: limbo_y0,
        width: limbo_width, height: limbo_height,
        strokeWidth: 1
      }, {
        onChange: canvas.renderAll.bind(canvas),
        duration: 500,
        easing: fabric.util.ease.easeOutCubic
      });
      setTimeout(function () {
        canvas.remove(zoomrect)}, 1000);
    } else {
      console.log('Turn change... (last play to %d)', playspot);

      if (firstTurn) {
        firstTurn = false;
      }

      oldlimbo = newlimbo;
      newlimbo = -1;
      lastplay = -1;
      console.log(' now: oldlimbo %d, newlimbo %d', oldlimbo, newlimbo);

      if (phase == USER_TURN) {
        phase = COMP_TURN;
        $('#info').text('Computers turn.');
        doComputerMove();
        $('#endturn').trigger('click');
      } else {
        phase = USER_TURN;
        $('#info').text('Your turn.');
      }
    }
  });

  /////
  // INIT

  phase = COMP_TURN;
  var startx = getRandomInt(0,15);
  var nx = limbo_x0+offset, ny = limbo_y0+offset;
  handleMove(startx, pieces[startx].get('left'), pieces[startx].get('top'),
    nx, ny);
  pieces[startx].animate({
    left: ((startx & SHORT) == 0) ? nx+poffset_lg : nx+poffset_sm,
    top: ((startx & SHORT) == 0) ? ny+poffset_lg : ny+poffset_sm
  }, {
    onChange: canvas.renderAll.bind(canvas),
    duration: 400,
    easing: fabric.util.ease.easeOutCubic
  });

  console.log('triggering click...');
  $('#endturn').trigger('click');
  // $('#info').text('Users turn.');



  /////
  // PIECE MOVEMENT HANDLING
  /////

  // piece selection
  canvas.on('object:selected', function(e) {
    curunit = canvas.getActiveObject().get('id');
    console.log('Unit selected:', curunit);
  });
  canvas.on('selection:cleared', function(e) {
    curunit = -1;
    console.log('Selection cleared.')
  });


  // piece move

  // shadow
  var shadow = new fabric.Rect({ 
    left: 0, top: 0, width: gridsize - 1, height: gridsize - 1, 
    fill: 'rgba(10,10,10,0.3)', selectable: false
  });

  var inmotion = false;
  var ox = 0;  // position before moving
  var oy = 0;
  var nx = 0;  // future position once dropped
  var ny = 0;

  canvas.on('object:moving', function(e) { 
  	// set shadow effects
    if (!inmotion) {
    	// if just started moving, put shadow where piece is
      inmotion = true;
      ox = e.target.get('left');
      oy = e.target.get('top');
      shadow.set({left: ox, top: oy});
      canvas.add(shadow);
      canvas.bringToFront(e.target);
    }
    else {
    	// otherwise put shadow wherever piece will be dropped upon mouse release
    	tx = e.target.left;
    	ty = e.target.top;
    	if (tx < pool_width - gridsize) {
    		nx = Math.round(tx / gridsize) * gridsize + offset;
    		ny = Math.round(ty / gridsize) * gridsize + offset;
    	} else if (tx > board_x0) {
    		nx = Math.round((tx - board_x0) / gridsize) * gridsize + board_x0 + offset;
    		ny = Math.round(ty / gridsize) * gridsize + offset;
    	} else {
    		nx = limbo_x0 + offset;
    		ny = limbo_y0 + offset;
    	}
    	if (checkValidMove(nx, ny)) {
    		shadow.set({left: nx + 1, top: ny + 1, fill: 'rgba(10,10,10,0.2)'});
    	} else {
    		shadow.set({left: nx + 1, top: ny + 1, fill: 'rgba(255,0,0,0.8)'});
    	}
    	// shadow.set({left: nx + 1, top: ny + 1});
    }
  });

  canvas.on('object:modified', function(e) {
    if (inmotion) {
      inmotion = false;

      // remove shadow and animate piece stopping
      if (!checkValidMove(nx, ny)) {
      	// if not a valid drop, just move it back to its prev location
        e.target.animate({
          left: ox, top: oy
        }, {
          onChange: canvas.renderAll.bind(canvas),
          duration: 400,
          easing: fabric.util.ease.easeOutCubic
        });
      } else {
        handleMove(curunit, ox, oy, nx, ny)
        e.target.animate({
          left: ((curunit & SHORT) == 0) ? nx+poffset_lg : nx+poffset_sm,
          top: ((curunit & SHORT) == 0) ? ny+poffset_lg : ny+poffset_sm
        }, {
          onChange: canvas.renderAll.bind(canvas),
          duration: 400,
          easing: fabric.util.ease.easeOutCubic
        });
      }
      canvas.remove(shadow);
    }
  });
});







