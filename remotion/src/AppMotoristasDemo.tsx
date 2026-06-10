import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from "remotion";

const scenes = [
  {
    file: "01-home.png",
    title: "Início",
    caption: "Módulos do motorista em uma tela.",
    start: 0
  },
  {
    file: "02-services.png",
    title: "Serviços",
    caption: "Agenda real, separada por dia e prioridade.",
    start: 75
  },
  {
    file: "03-details.png",
    title: "Detalhes",
    caption: "Trajeto, passageiro, veículo e observações.",
    start: 150
  },
  {
    file: "04-voucher.png",
    title: "Voucher",
    caption: "Campos operacionais antes da assinatura.",
    start: 225
  },
  {
    file: "05-signature.png",
    title: "Assinatura",
    caption: "Coleta direta no aparelho do motorista.",
    start: 300
  },
  {
    file: "06-maintenance.png",
    title: "Manutenção",
    caption: "Serviço de manutenção com contexto do veículo.",
    start: 375
  },
  {
    file: "07-finalize-maintenance.png",
    title: "Finalização",
    caption: "Registro de serviço, valor, pagamento e fotos.",
    start: 450
  },
  {
    file: "08-expenses.png",
    title: "Gastos",
    caption: "Lançamento de despesas do motorista.",
    start: 525
  }
] as const;

const sceneLength = 75;

function PhoneShot({ file, title, caption, offset }: { file: string; title: string; caption: string; offset: number }) {
  const frame = useCurrentFrame() - offset;
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 28, stiffness: 130, mass: 0.8 } });
  const y = interpolate(enter, [0, 1], [54, 0]);
  const scale = interpolate(enter, [0, 1], [0.965, 1]);
  const opacity = interpolate(frame, [0, 12, sceneLength - 12, sceneLength], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={styles.stage}>
        <div style={{ ...styles.header, transform: `translateY(${y * 0.45}px)` }}>
          <div style={styles.kicker}>App Betinhos Motoristas</div>
          <div style={styles.title}>{title}</div>
          <div style={styles.caption}>{caption}</div>
        </div>
        <div style={{ ...styles.phone, transform: `translateY(${y}px) scale(${scale})` }}>
          <Img src={staticFile(`screens/${file}`)} style={styles.image} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function AppMotoristasDemo() {
  return (
    <AbsoluteFill style={styles.root}>
      {scenes.map((scene) => (
        <Sequence key={scene.file} from={scene.start} durationInFrames={sceneLength}>
          <PhoneShot file={scene.file} title={scene.title} caption={scene.caption} offset={scene.start} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    background: "#f3f0ea",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#201c18"
  },
  stage: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "96px 72px"
  },
  header: {
    width: "820px",
    marginBottom: "46px"
  },
  kicker: {
    fontSize: 25,
    lineHeight: 1.2,
    color: "#7b1d20",
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    fontSize: 76,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: 0,
    marginTop: 14
  },
  caption: {
    fontSize: 34,
    lineHeight: 1.25,
    color: "#544941",
    marginTop: 20,
    maxWidth: 780
  },
  phone: {
    width: 780,
    height: 1688,
    borderRadius: 54,
    background: "#111",
    padding: 18,
    boxShadow: "0 34px 90px rgba(31, 23, 16, 0.26), 0 0 0 2px rgba(32, 28, 24, 0.08)"
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: 38,
    display: "block"
  }
};
