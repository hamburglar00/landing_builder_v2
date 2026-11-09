import { LandingBuilderLogo } from "./LandingBuilderLogo";
import "./PbadminConnectionScreen.css";

export function PbadminConnectionScreen({ error }: { error?: string }) {
  return (
    <main className="pbadmin-connection" data-error={Boolean(error)}>
      <div className="pbadmin-connection-content">
        <div className="pbadmin-connection-logo">
          <LandingBuilderLogo variant="mark" className="h-24 w-24" />
        </div>
        <h1>
          {error
            ? "No pudimos abrir LandingBuilder"
            : "Conectando con LandingBuilder…"}
        </h1>
        <p role={error ? "alert" : "status"}>
          {error || "Estamos abriendo tu espacio de trabajo."}
        </p>
        {error ? (
          <div className="pbadmin-connection-actions">
            <a href="/api/pbadmin/start">Volver a ingresar con PBAdmin</a>
          </div>
        ) : null}
      </div>
    </main>
  );
}
