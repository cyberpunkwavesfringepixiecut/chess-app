/* chess.logic.js — rules, legal moves, applyMove, promotion overlay, game end */

/* === BASIC HELPERS === */
function isWhitePiece(p) { return p && p === p.toUpperCase(); }
function isBlackPiece(p) { return p && p === p.toLowerCase(); }

function pieceName(t) {
  switch (t.toLowerCase()) {
    case "k": return "king";
    case "q": return "queen";
    case "r": return "rook";
    case "b": return "bishop";
    case "n": return "knight";
    case "p": return "pawn";
    default:  return "pawn";
  }
}

/* === ATTACK / CHECK === */
function squareAttacked(x, y, byWhite) {
  const pawnDir = byWhite ? -1 : 1;
  const pawnAttackFiles = [-1, 1];

  for (const dx of pawnAttackFiles) {
    const tx = x + dx;
    const ty = y + pawnDir;
    if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
      const p = board[ty][tx];
      if (p && p.toLowerCase() === "p" && (byWhite ? isWhitePiece(p) : isBlackPiece(p))) {
        return true;
      }
    }
  }

  const knightMoves = [
    [1,2],[2,1],[-1,2],[-2,1],
    [1,-2],[2,-1],[-1,-2],[-2,-1]
  ];
  for (const [dx,dy] of knightMoves) {
    const tx = x + dx;
    const ty = y + dy;
    if (tx < 0 || tx >= 8 || ty < 0 || ty >= 8) continue;
    const p = board[ty][tx];
    if (p && p.toLowerCase() === "n" && (byWhite ? isWhitePiece(p) : isBlackPiece(p))) {
      return true;
    }
  }

  const diagDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const [dx,dy] of diagDirs) {
    let tx = x + dx;
    let ty = y + dy;
    while (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
      const p = board[ty][tx];
      if (p) {
        if ((p.toLowerCase() === "b" || p.toLowerCase() === "q") &&
            (byWhite ? isWhitePiece(p) : isBlackPiece(p))) {
          return true;
        }
        break;
      }
      tx += dx;
      ty += dy;
    }
  }

  const lineDirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dx,dy] of lineDirs) {
    let tx = x + dx;
    let ty = y + dy;
    while (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
      const p = board[ty][tx];
      if (p) {
        if ((p.toLowerCase() === "r" || p.toLowerCase() === "q") &&
            (byWhite ? isWhitePiece(p) : isBlackPiece(p))) {
          return true;
        }
        break;
      }
      tx += dx;
      ty += dy;
    }
  }

  const kingSteps = [
    [1,0],[-1,0],[0,1],[0,-1],
    [1,1],[1,-1],[-1,1],[-1,-1]
  ];
  for (const [dx,dy] of kingSteps) {
    const tx = x + dx;
    const ty = y + dy;
    if (tx < 0 || tx >= 8 || ty < 0 || ty >= 8) continue;
    const p = board[ty][tx];
    if (p && p.toLowerCase() === "k" && (byWhite ? isWhitePiece(p) : isBlackPiece(p))) {
      return true;
    }
  }

  return false;
}

function findKing(white) {
  const target = white ? "K" : "k";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (board[y][x] === target) return { x, y };
    }
  }
  return null;
}

function inCheck(white) {
  const kingPos = findKing(white);
  if (!kingPos) return false;
  return squareAttacked(kingPos.x, kingPos.y, !white);
}

/* === PSEUDO MOVES === */
function generatePseudoMovesForSquare(x, y) {
  const piece = board[y][x];
  if (!piece) return [];
  const moves = [];
  const isWhite = isWhitePiece(piece);
  const dir = isWhite ? -1 : 1;

  const addMove = (fromX, fromY, toX, toY, special = null) => {
    if (toX < 0 || toX > 7 || toY < 0 || toY > 7) return;
    const target = board[toY][toX];
    if (special === "castle") {
      moves.push({ fromX, fromY, toX, toY, special });
      return;
    }
    if (!target) {
      moves.push({ fromX, fromY, toX, toY, special });
    } else {
      if (isWhite && isBlackPiece(target)) moves.push({ fromX, fromY, toX, toY, special });
      if (!isWhite && isWhitePiece(target)) moves.push({ fromX, fromY, toX, toY, special });
    }
  };

  const type = piece.toLowerCase();

  /* Pawn */
  if (type === "p") {
    const startRank = isWhite ? 6 : 1;
    const oneY = y + dir;
    if (oneY >= 0 && oneY <= 7 && !board[oneY][x]) {
      addMove(x, y, x, oneY);
      const twoY = y + 2 * dir;
      if (y === startRank && !board[twoY][x]) {
        addMove(x, y, x, twoY);
      }
    }
    [-1, 1].forEach(dx => {
      const tx = x + dx;
      const ty = y + dir;
      if (tx >= 0 && tx <= 7 && ty >= 0 && ty <= 7) {
        const target = board[ty][tx];
        if (target && ((isWhite && isBlackPiece(target)) || (!isWhite && isWhitePiece(target)))) {
          addMove(x, y, tx, ty);
        }
      }
    });
    if (enPassantTarget) {
      const ep = coordToIndex(enPassantTarget);
      if (ep.y === y + dir && Math.abs(ep.x - x) === 1) {
        addMove(x, y, ep.x, ep.y, "enpassant");
      }
    }
  }

  /* Knight */
  if (type === "n") {
    const jumps = [
      [1,2],[2,1],[-1,2],[-2,1],
      [1,-2],[2,-1],[-1,-2],[-2,-1]
    ];
    jumps.forEach(([dx,dy]) => {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || tx > 7 || ty < 0 || ty > 7) return;
      const target = board[ty][tx];
      if (!target || (isWhite && isBlackPiece(target)) || (!isWhite && isWhitePiece(target))) {
        addMove(x, y, tx, ty);
      }
    });
  }

  /* Bishop / Rook / Queen */
  if (type === "b" || type === "r" || type === "q") {
    const dirs = [];
    if (type === "b" || type === "q") {
      dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
    }
    if (type === "r" || type === "q") {
      dirs.push([1,0],[-1,0],[0,1],[0,-1]);
    }
    dirs.forEach(([dx,dy]) => {
      let tx = x + dx;
      let ty = y + dy;
      while (tx >= 0 && tx <= 7 && ty >= 0 && ty <= 7) {
        const target = board[ty][tx];
        if (!target) {
          addMove(x, y, tx, ty);
        } else {
          if ((isWhite && isBlackPiece(target)) || (!isWhite && isWhitePiece(target))) {
            addMove(x, y, tx, ty);
          }
          break;
        }
        tx += dx;
        ty += dy;
      }
    });
  }

  /* King */
  if (type === "k") {
    const steps = [
      [1,0],[-1,0],[0,1],[0,-1],
      [1,1],[1,-1],[-1,1],[-1,-1]
    ];
    steps.forEach(([dx,dy]) => {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || tx > 7 || ty < 0 || ty > 7) return;
      const target = board[ty][tx];
      if (!target || (isWhite && isBlackPiece(target)) || (!isWhite && isWhitePiece(target))) {
        addMove(x, y, tx, ty);
      }
    });

    if (isWhite && y === 7 && x === 4) {
      if (castlingRights.WK &&
          !board[7][5] && !board[7][6] &&
          board[7][7] === "R") {
        addMove(x, y, 6, 7, "castle");
      }
      if (castlingRights.WQ &&
          !board[7][3] && !board[7][2] && !board[7][1] &&
          board[7][0] === "R") {
        addMove(x, y, 2, 7, "castle");
      }
    }
    if (!isWhite && y === 0 && x === 4) {
      if (castlingRights.BK &&
          !board[0][5] && !board[0][6] &&
          board[0][7] === "r") {
        addMove(x, y, 6, 0, "castle");
      }
      if (castlingRights.BQ &&
          !board[0][3] && !board[0][2] && !board[0][1] &&
          board[0][0] === "r") {
        addMove(x, y, 2, 0, "castle");
      }
    }
  }

  return moves;
}

/* === LEGAL MOVES === */
function generateLegalMovesForSquare(x, y) {
  const piece = board[y][x];
  if (!piece) return [];
  const isWhite = isWhitePiece(piece);
  if ((whiteToMove && !isWhite) || (!whiteToMove && isWhite)) return [];

  const pseudo = generatePseudoMovesForSquare(x, y);
  const legal = [];

  for (const m of pseudo) {
    const savedBoard = cloneBoard(board);
    const savedCastling = { ...castlingRights };
    const savedEP = enPassantTarget;
    const savedWTM = whiteToMove;

    applyMoveInternal(m, { skipHistory: true });

    const stillInCheck = inCheck(savedWTM);
    if (!stillInCheck) {
      if (m.special === "castle") {
        const kingPos = findKing(savedWTM);
        const pathSquares = [];
        if (m.toX === 6) {
          pathSquares.push({ x: 5, y: kingPos.y }, { x: 6, y: kingPos.y });
        } else if (m.toX === 2) {
          pathSquares.push({ x: 3, y: kingPos.y }, { x: 2, y: kingPos.y });
        }
        let illegal = false;
        for (const sq of pathSquares) {
          if (squareAttacked(sq.x, sq.y, !savedWTM)) {
            illegal = true;
            break;
          }
        }
        if (!illegal) legal.push(m);
      } else {
        legal.push(m);
      }
    }

    board = savedBoard;
    castlingRights = savedCastling;
    enPassantTarget = savedEP;
    whiteToMove = savedWTM;
  }

  return legal;
}

/* === INTERNAL MOVE === */
function applyMoveInternal(move, options = {}) {
  const { fromX, fromY, toX, toY, special } = move;
  const piece = board[fromY][fromX];

  board[fromY][fromX] = "";
  board[toY][toX] = piece;

  if (special === "enpassant") {
    const epY = whiteToMove ? toY + 1 : toY - 1;
    board[epY][toX] = "";
  }

  if (special === "castle") {
    if (toX === 6) {
      const rookFromX = 7;
      const rookToX = 5;
      const rookY = fromY;
      board[rookY][rookFromX] = "";
      board[rookY][rookToX] = isWhitePiece(piece) ? "R" : "r";
    } else if (toX === 2) {
      const rookFromX = 0;
      const rookToX = 3;
      const rookY = fromY;
      board[rookY][rookFromX] = "";
      board[rookY][rookToX] = isWhitePiece(piece) ? "R" : "r";
    }
  }

  enPassantTarget = null;
  if (piece.toLowerCase() === "p" && Math.abs(toY - fromY) === 2) {
    const epRank = (fromY + toY) / 2;
    enPassantTarget = indexToCoord(fromX, epRank);
  }

  if (piece === "K") {
    castlingRights.WK = false;
    castlingRights.WQ = false;
  }
  if (piece === "k") {
    castlingRights.BK = false;
    castlingRights.BQ = false;
  }
  if (piece === "R") {
    if (fromY === 7 && fromX === 0) castlingRights.WQ = false;
    if (fromY === 7 && fromX === 7) castlingRights.WK = false;
  }
  if (piece === "r") {
    if (fromY === 0 && fromX === 0) castlingRights.BQ = false;
    if (fromY === 0 && fromX === 7) castlingRights.BK = false;
  }

  if (piece.toLowerCase() === "p" && (toY === 0 || toY === 7)) {
    let promoteTo = options.promoteTo || "q";
    board[toY][toX] = isWhitePiece(piece)
      ? promoteTo.toUpperCase()
      : promoteTo.toLowerCase();
  }
}

/* === PROMOTION OVERLAY === */
function openPromotionOverlay(isWhite) {
  promotionChoicesEl.innerHTML = "";

  const choices = ["q", "r", "b", "n"];
  choices.forEach(type => {
    const side = isWhite ? "white" : "black";
    const svgPath = `chess-data/pieces/${side}_${pieceName(type)}.svg`;

    const btn = document.createElement("img");
    btn.src = svgPath;
    btn.className = "promotion-choice-icon";
    btn.dataset.promoteTo = type;

    btn.onclick = () => {
      finalizePromotion(type);
    };

    promotionChoicesEl.appendChild(btn);
  });

  promotionOverlayEl.classList.remove("hidden");
}

/* FINALIZE PROMOTION */
function finalizePromotion(type) {
  const move = pendingPromotionMove;
  const isWhite = pendingPromotionIsWhite;

  pendingPromotionMove = null;
  pendingPromotionIsWhite = null;
  promotionOverlayEl.classList.add("hidden");

  applyMove(move, { promoteTo: type });
}

/* === APPLY MOVE (HUMAN OR AI) === */
function applyMove(move, options = {}) {
  const { fromX, fromY, toX, toY, special } = move;

  const legalMoves = generateLegalMovesForSquare(fromX, fromY);
  const isLegal = legalMoves.some(m =>
    m.toX === toX && m.toY === toY && m.special === special
  );
  if (!isLegal && !options.promoteTo) {
    playMoveSounds("illegal");
    return;
  }

  const piece = board[fromY][fromX];
  const target = board[toY][toX];
  const prevBoard = cloneBoard(board);
  const prevCastling = { ...castlingRights };
  const prevEP = enPassantTarget;
  const prevWTM = whiteToMove;

  let captured = target || null;

  board[fromY][fromX] = "";
  board[toY][toX] = piece;

  if (special === "enpassant") {
    const epY = whiteToMove ? toY + 1 : toY - 1;
    captured = board[epY][toX];
    board[epY][toX] = "";
  }

  if (special === "castle") {
    if (toX === 6) {
      const rookFromX = 7;
      const rookToX = 5;
      const rookY = fromY;
      board[rookY][rookFromX] = "";
      board[rookY][rookToX] = isWhitePiece(piece) ? "R" : "r";
    } else if (toX === 2) {
      const rookFromX = 0;
      const rookToX = 3;
      const rookY = fromY;
      board[rookY][rookFromX] = "";
      board[rookY][rookToX] = isWhitePiece(piece) ? "R" : "r";
    }
  }

  enPassantTarget = null;
  if (piece.toLowerCase() === "p" && Math.abs(toY - fromY) === 2) {
    const epRank = (fromY + toY) / 2;
    enPassantTarget = indexToCoord(fromX, epRank);
  }

  if (piece === "K") {
    castlingRights.WK = false;
    castlingRights.WQ = false;
  }
  if (piece === "k") {
    castlingRights.BK = false;
    castlingRights.BQ = false;
  }
  if (piece === "R") {
    if (fromY === 7 && fromX === 0) castlingRights.WQ = false;
    if (fromY === 7 && fromX === 7) castlingRights.WK = false;
  }
  if (piece === "r") {
    if (fromY === 0 && fromX === 0) castlingRights.BQ = false;
    if (fromY === 0 && fromX === 7) castlingRights.BK = false;
  }

  if (piece.toLowerCase() === "p" && (toY === 0 || toY === 7)) {
    if (!options.promoteTo) {
      pendingPromotionMove = move;
      pendingPromotionIsWhite = isWhitePiece(piece);

      board = prevBoard;
      castlingRights = prevCastling;
      enPassantTarget = prevEP;

      openPromotionOverlay(pendingPromotionIsWhite);
      return;
    }

    const promoteTo = options.promoteTo;
    board[toY][toX] = isWhitePiece(piece)
      ? promoteTo.toUpperCase()
      : promoteTo.toLowerCase();
  }

  moveHistory.push({
    move,
    prevBoard,
    prevCastling,
    prevEP,
    captured,
    whiteToMoveBefore: prevWTM
  });
  redoStack = [];

  const sideWhite = prevWTM;
  const inChkAfter = inCheck(!sideWhite);
  let resultType = "normal";
  if (captured) resultType = "capture";
  if (inChkAfter) resultType = "check";

  lastMoveInfo = {
    fromX,
    fromY,
    toX,
    toY,
    resultType,
    special,
    sideWhite
  };

  whiteToMove = !whiteToMove;

  if (captured) {
    const capturedEl = isWhitePiece(captured)
      ? capturedPlayerEl
      : capturedAiEl;

    const isWhiteCap = isWhitePiece(captured);
    const typeCap = captured.toLowerCase();
    const sideCap = isWhiteCap ? "white" : "black";
    const svgPathCap = `chess-data/pieces/${sideCap}_${pieceName(typeCap)}.svg`;

    const imgCap = document.createElement("img");
    imgCap.className = "captured-piece-img";
    imgCap.src = svgPathCap;
    imgCap.onerror = () => {
      imgCap.style.opacity = "0.6";
    };
    capturedEl.appendChild(imgCap);
  }

  logMove(move, piece, captured);
  playMoveSounds(resultType);

  const ended = checkGameEnd();
  if (ended) return;

  renderBoard();
  sendFenToEngine();
  requestAiMoveIfNeeded();
}

/* === LOGGING === */
function logMove(move, piece, captured) {
  const li = document.createElement("li");
  const from = indexToCoord(move.fromX, move.fromY);
  const to = indexToCoord(move.toX, move.toY);
  let text = piece.toUpperCase() + " " + from + "→" + to;
  if (captured) text += " x" + pieceName(captured.toLowerCase());
  if (move.special === "castle") text += " (castle)";
  if (move.special === "enpassant") text += " (ep)";
  li.textContent = text;
  moveLogEl.appendChild(li);
  moveLogEl.scrollTop = moveLogEl.scrollHeight;
}

/* === GAME END === */
function checkGameEnd() {
  const sideWhite = whiteToMove;
  const inChk = inCheck(sideWhite);

  let hasMove = false;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (!p) continue;
      if (sideWhite && !isWhitePiece(p)) continue;
      if (!sideWhite && !isBlackPiece(p)) continue;

      const moves = generateLegalMovesForSquare(x, y);
      if (moves.length > 0) {
        hasMove = true;
        break;
      }
    }
    if (hasMove) break;
  }

  if (!hasMove) {
    if (inChk) {
      const winner = sideWhite ? "Black" : "White";
      winTextEl.textContent = winner + " Wins";
      if (lastMoveInfo) lastMoveInfo.resultType = "checkmate";
      playCheckmateSound();
    } else {
      winTextEl.textContent = "Draw (stalemate)";
    }

    winOverlayEl.classList.remove("hidden");
    return true;
  }

  return false;
}

/* === EXPORT GLOBALS === */
window.squareAttacked = squareAttacked;
window.generatePseudoMovesForSquare = generatePseudoMovesForSquare;
window.generateLegalMovesForSquare = generateLegalMovesForSquare;
window.applyMove = applyMove;
window.checkGameEnd = checkGameEnd;
window.inCheck = inCheck;
window.findKing = findKing;
window.openPromotionOverlay = openPromotionOverlay;
