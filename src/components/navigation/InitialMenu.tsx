import logoBetinhosB from "../../../extracted-msapp/Assets/Images/bd7d5f28-81c5-4c0e-9c19-59e59e1d22cf.png";
import { Avatar } from "../common/Avatar";

type XrmWindow = Window & {
  Xrm?: {
    Utility?: {
      getGlobalContext?: () => {
        userSettings?: {
          userName?: string;
        };
      };
    };
  };
};

function getFirstName(name?: string) {
  return name?.trim().split(/\s+/)[0] || "Renan";
}

export function InitialMenu() {
  const userName = (window as XrmWindow).Xrm?.Utility?.getGlobalContext?.().userSettings?.userName;

  return (
    <header className="menu">
      <div className="menu-inner">
        <img className="logo" src={logoBetinhosB} alt="" />
        <div className="hello">Olá, {getFirstName(userName)}</div>
        <Avatar />
      </div>
    </header>
  );
}
