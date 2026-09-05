import { COINS, UNITS, SPR_OF } from "../game/constants.js";
import { SPRITES } from "../game/sprites.js";
import { S, money, posTotal } from "../game/state.js";
import { groupTroops } from "../game/combat.js";
import { useEngineVersion } from "../hooks/useEngineStore.js";

export default function TroopPanel({ engine }) {
  useEngineVersion(engine);
  const mine = S.units.filter(u => u.alive && u.p === 0);
  const gs = groupTroops(mine);
  const count = mine.length ? mine.length + " 隻 · " + money(posTotal(S.players[0])) : "0 隻";

  const pick = (o) => engine.focusUnit(o.units[0]);
  const doSettle = (e, o) => { e.stopPropagation(); engine.settleGroup(o.k, o.coin); };

  return (
    <aside className="ovl troops" id="troopbox">
      <h2><span>我的部隊</span><b id="tcount">{count}</b></h2>
      <div className="tlist" id="tlist">
        {!gs.length && <div className="tempty">場上沒有部隊。<br />從下方角色卡召喚（＝買入對應的幣）。</div>}
        {gs.map(o => {
          const ch = COINS[o.coin], hot = o.pl >= 12;
          const st = o.fight ? [`交戰中 ${o.fight}/${o.n}`, "#F2555A"]
            : o.mining ? [`挖礦中 ${o.mining}/${o.n}`, "#A3E635"]
            : o.moving ? [`移動中 ${o.moving}/${o.n}`, "#8A9583"] : ["駐守中", "#8A9583"];
          return (
            <button className={`trow ${o.sel ? "on" : ""} ${o.fight ? "fight" : ""} ${hot ? "cash" : ""}`}
              key={o.k + "|" + o.coin} onClick={() => pick(o)}>
              <i className="tg" style={{ borderColor: ch.hex }}><img src={SPRITES[SPR_OF[o.k] || o.k].w[0]} alt="" /></i>
              <span className="tmid">
                <span className="tl">
                  <span className="tn">{UNITS[o.k].n} <b>×{o.n}</b><em>{o.coin}</em></span>
                  <span className="tpl" style={{ color: o.pl >= 0 ? "var(--up)" : "var(--down)" }}>
                    {(o.pl >= 0 ? "+" : "") + o.pl.toFixed(1)}%
                  </span>
                </span>
                <span className="thp"><i style={{ width: (o.hp * 100).toFixed(0) + "%", background: o.hp > 0.5 ? "var(--lime)" : "var(--down)" }}></i></span>
                <span className="tst" style={{ color: hot ? "#A3E635" : st[1] }}>{hot ? "可結算" : st[0]} · {money(o.ret)}</span>
              </span>
              <span className="tset" onClick={(e) => doSettle(e, o)}>結</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
