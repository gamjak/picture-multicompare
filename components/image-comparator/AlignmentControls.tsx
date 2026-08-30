'use client';

import {
  Check,
  Crosshair,
  Eye,
  EyeOff,
  RefreshCw,
  Undo2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import { SLOT_IDS } from './files';
import type {
  AlignmentEntry,
  ManualAlignmentSession,
  StageImage,
} from './types';

type AlignmentControlsProps = {
  images: StageImage[];
  enabled: boolean;
  showPoints: boolean;
  referenceId: string | null;
  entriesByImageId: Record<string, AlignmentEntry>;
  manualSession: ManualAlignmentSession | null;
  onEnabledChange: (enabled: boolean) => void;
  onShowPointsChange: (show: boolean) => void;
  onReanalyze: (targetId?: string) => void;
  onBeginManual: (targetId: string) => void;
  onUndoManual: () => void;
  onCancelManual: () => void;
  onApplyManual: () => boolean;
};

const orderedImages = (images: StageImage[]) =>
  [...images].sort(
    (left, right) => SLOT_IDS.indexOf(left.slot) - SLOT_IDS.indexOf(right.slot),
  );

function summaryText(
  imageCount: number,
  enabled: boolean,
  entries: AlignmentEntry[],
) {
  if (imageCount < 2) {
    return 'Mindestens 2 Bilder';
  }
  if (!enabled) {
    return 'Ausrichtung aus';
  }
  if (
    entries.some((entry) => entry.status === 'analyzing') ||
    entries.length < imageCount - 1
  ) {
    return 'Wird ausgerichtet …';
  }

  const alignedCount = entries.filter(
    (entry) => entry.status === 'aligned',
  ).length;
  if (alignedCount === entries.length) {
    return '3 Punkte gefunden · Ausrichtung aktiv';
  }
  if (alignedCount > 0) {
    return 'Teilweise ausgerichtet';
  }
  return 'Nicht sicher · normal zentriert';
}

function targetStatus(entry: AlignmentEntry | undefined) {
  if (!entry || entry.status === 'analyzing') {
    return 'Wird geprüft';
  }
  if (entry.status === 'failed') {
    return 'Nicht sicher';
  }
  if (entry.source === 'manual') {
    return 'Manuell';
  }
  return `Automatisch · ${Math.round(entry.confidence * 100)}%`;
}

export function AlignmentControls({
  images,
  enabled,
  showPoints,
  referenceId,
  entriesByImageId,
  manualSession,
  onEnabledChange,
  onShowPointsChange,
  onReanalyze,
  onBeginManual,
  onUndoManual,
  onCancelManual,
  onApplyManual,
}: AlignmentControlsProps) {
  const ordered = orderedImages(images);
  const targets = ordered.filter((image) => image.id !== referenceId);
  const entries = targets
    .map((image) => entriesByImageId[image.id])
    .filter((entry): entry is AlignmentEntry => Boolean(entry));
  const hasAlignedTarget = entries.some((entry) => entry.status === 'aligned');
  const isAnalyzing =
    entries.length < targets.length ||
    entries.some((entry) => entry.status === 'analyzing');
  const targetInManual = manualSession
    ? targets.find((image) => image.id === manualSession.targetId)
    : undefined;
  const selectedPointCount = manualSession
    ? manualSession.referencePoints.length + manualSession.targetPoints.length
    : 0;

  let manualInstruction = '';
  if (manualSession?.phase === 'reference') {
    manualInstruction = `Punkt ${manualSession.referencePoints.length + 1} von 3 in Bild A markieren`;
  } else if (manualSession?.phase === 'target') {
    manualInstruction = `Punkt ${manualSession.targetPoints.length + 1} von 3 in Bild ${targetInManual?.slot ?? 'Zielbild'} markieren`;
  } else if (manualSession?.phase === 'ready') {
    manualInstruction = 'Alle 3 Punktpaare sind markiert.';
  }

  return (
    <section className="alignment-controls" aria-label="Bildausrichtung">
      <div className="alignment-primary">
        <label className="alignment-switch">
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            aria-checked={enabled}
            disabled={images.length < 2}
            aria-label="Automatisch ausrichten"
            onChange={(event) => onEnabledChange(event.currentTarget.checked)}
          />
          <span className="switch-track" aria-hidden="true">
            <span />
          </span>
          <span className="switch-copy">
            <strong>Automatisch ausrichten</strong>
            <small>3 lokale Merkmalspunkte · A ist immer Referenz</small>
          </span>
        </label>

        <span
          className="alignment-summary"
          data-state={
            !enabled
              ? 'off'
              : entries.some((entry) => entry.status === 'failed')
                ? 'warning'
                : 'active'
          }
          aria-live="polite"
        >
          {summaryText(images.length, enabled, entries)}
        </span>

        <div className="alignment-actions">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!enabled || images.length < 2 || isAnalyzing}
            onClick={() => onReanalyze()}
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Neu analysieren
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={showPoints}
            disabled={!enabled || !hasAlignedTarget}
            onClick={() => onShowPointsChange(!showPoints)}
          >
            {showPoints ? (
              <EyeOff data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Eye data-icon="inline-start" aria-hidden="true" />
            )}
            {showPoints ? 'Punkte ausblenden' : 'Punkte anzeigen'}
          </Button>
        </div>
      </div>

      {images.length >= 2 ? (
        <div
          className="alignment-targets"
          aria-label="Ausrichtungsstatus je Bild"
        >
          {targets.map((image) => {
            const entry = entriesByImageId[image.id];
            return (
              <div className="alignment-target" key={image.id}>
                <span className="alignment-slot">{image.slot}</span>
                <span className="alignment-target-name" title={image.name}>
                  {image.name}
                </span>
                <span
                  className="alignment-target-status"
                  data-state={entry?.status ?? 'waiting'}
                >
                  {targetStatus(entry)}
                </span>
                {entry?.status === 'failed' && enabled && !manualSession ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => onBeginManual(image.id)}
                  >
                    <Crosshair data-icon="inline-start" aria-hidden="true" />3
                    Punkte manuell setzen
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {manualSession ? (
        <div
          className="manual-alignment"
          aria-label="Manuelle Drei-Punkt-Ausrichtung"
        >
          <div className="manual-alignment-copy">
            <span className="manual-step" aria-hidden="true">
              {Math.min(6, selectedPointCount + 1)}/6
            </span>
            <div>
              <strong aria-live="polite" aria-atomic="true">
                {manualInstruction}
              </strong>
              <small>
                Klicke ins Bild oder bewege das Fadenkreuz mit den Pfeiltasten
                und bestätige mit Eingabe. Wähle gut erkennbare Punkte,
                möglichst weit voneinander entfernt.
              </small>
              {manualSession.error === 'spread' ? (
                <em>
                  Die drei Punkte müssen weiter auseinanderliegen und dürfen
                  nicht auf einer Linie liegen.
                </em>
              ) : null}
              {manualSession.error === 'missing-metrics' ? (
                <em>
                  Die Bildmaße sind noch nicht verfügbar. Bitte kurz warten.
                </em>
              ) : null}
            </div>
          </div>
          <div className="manual-alignment-actions">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={selectedPointCount === 0}
              onClick={onUndoManual}
            >
              <Undo2 data-icon="inline-start" aria-hidden="true" />
              Rückgängig
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCancelManual}
            >
              <X data-icon="inline-start" aria-hidden="true" />
              Abbrechen
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={manualSession.phase !== 'ready'}
              onClick={() => onApplyManual()}
            >
              <Check data-icon="inline-start" aria-hidden="true" />
              Ausrichtung anwenden
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
