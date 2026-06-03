import logoBetinhosB from "../../../extracted-msapp/Assets/Images/bd7d5f28-81c5-4c0e-9c19-59e59e1d22cf.png";
import { Avatar } from "../common/Avatar";

export function InitialMenu() {
  return (
    <header className="menu">
      <div className="menu-inner">
        <img className="logo" src={logoBetinhosB} alt="" />
        <div className="hello">Olá, Renan Mendonça</div>
        <Avatar />
      </div>
    </header>
  );
}
