import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Button, Select } from "../ui";
import { AlertCircle, ChevronRight, X } from "lucide-react";
import ManagerProfileList from "./ManagerProfileList";
import type { ManagerProfile } from "./types";

const CreateManagerNationalityField = lazy(() => import("./CreateManagerNationalityField"));

export interface CreateManagerFormData {
  firstName: string;
  lastName: string;
  startYear: string;
  startPhase: CareerStartPhase;
  nationality: string;
}

export type CareerStartPhase = "seasonStart" | "midSeason";

type CreateManagerField = keyof CreateManagerFormData;

interface CreateManagerFormProps {
  formData: CreateManagerFormData;
  formErrors: Partial<Record<CreateManagerField, string>>;
  profiles: ManagerProfile[];
  selectedProfileId?: string;
  onChange: (field: CreateManagerField, value: string) => void;
  onClearError: (field: CreateManagerField) => void;
  onClose: () => void;
  onSelectProfile: (profile: ManagerProfile) => void;
  onDeleteProfile: (id: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function NationalityFieldFallback({ error }: { error?: string }) {
  const { t } = useTranslation();

  return (
    <div id="create-manager-field-nationality">
      <label
        htmlFor="create-manager-nationality-trigger"
        className="mb-1.5 block text-caption font-heading font-bold uppercase tracking-label text-fg-muted"
      >
        {t("createManager.countryOfOrigin")}
      </label>
      <div className="relative">
        <button
          id="create-manager-nationality-trigger"
          type="button"
          disabled
          className={`w-full rounded-control border bg-sunken p-3 text-left transition-all ${
            error ? "border-danger" : "border-line-strong"
          }`}
        >
          <span className="text-fg-subtle">{t("createManager.selectCountry")}</span>
        </button>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-selected border-t-transparent" />
        </div>
      </div>
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-caption text-danger">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function CreateManagerForm({
  formData,
  formErrors,
  profiles,
  selectedProfileId,
  onChange,
  onClearError,
  onClose,
  onSelectProfile,
  onDeleteProfile,
  onSubmit,
}: CreateManagerFormProps) {
  const { t, i18n } = useTranslation();

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-heading font-heading font-bold uppercase tracking-label text-fg transition-colors">
          {t("createManager.title")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-control p-1 text-fg-subtle transition-colors hover:bg-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          aria-label={t("common.close")}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mb-1 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-selected-fill text-caption font-bold text-on-brand">
          1
        </div>
        <div className="h-0.5 flex-1 bg-hover" />
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-hover text-caption font-bold text-fg-subtle">
          2
        </div>
      </div>

      <ManagerProfileList
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onSelect={onSelectProfile}
        onDelete={onDeleteProfile}
      />

      <div className="flex gap-3">
        <div className="flex-1" id="create-manager-field-firstName">
          <label
            htmlFor="create-manager-first-name"
            className="mb-1.5 block text-caption font-heading font-bold uppercase tracking-label text-fg-muted"
          >
            {t("createManager.firstName")}
          </label>
          <input
            id="create-manager-first-name"
            maxLength={30}
            className={`w-full rounded-control border bg-sunken p-3 text-fg outline-none transition-all placeholder:text-fg-subtle focus:ring-2 placeholder:text-fg-muted ${
              formErrors.firstName
                ? "border-danger focus:border-danger focus-visible:ring-focus"
                : "border-line-strong focus:border-selected focus:ring-selected/20"
            }`}
            placeholder={t("createManager.placeholderFirst")}
            value={formData.firstName}
            onChange={(event) => {
              onChange("firstName", event.target.value);
              onClearError("firstName");
            }}
          />
          {formErrors.firstName ? (
            <p className="mt-1 flex items-center gap-1 text-caption text-danger">
              <AlertCircle className="h-3 w-3" />
              {formErrors.firstName}
            </p>
          ) : null}
        </div>

        <div className="flex-1" id="create-manager-field-lastName">
          <label
            htmlFor="create-manager-last-name"
            className="mb-1.5 block text-caption font-heading font-bold uppercase tracking-label text-fg-muted"
          >
            {t("createManager.lastName")}
          </label>
          <input
            id="create-manager-last-name"
            maxLength={30}
            className={`w-full rounded-control border bg-sunken p-3 text-fg outline-none transition-all placeholder:text-fg-subtle focus:ring-2 placeholder:text-fg-muted ${
              formErrors.lastName
                ? "border-danger focus:border-danger focus-visible:ring-focus"
                : "border-line-strong focus:border-selected focus:ring-selected/20"
            }`}
            placeholder={t("createManager.placeholderLast")}
            value={formData.lastName}
            onChange={(event) => {
              onChange("lastName", event.target.value);
              onClearError("lastName");
            }}
          />
          {formErrors.lastName ? (
            <p className="mt-1 flex items-center gap-1 text-caption text-danger">
              <AlertCircle className="h-3 w-3" />
              {formErrors.lastName}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1" id="create-manager-field-startYear">
          <label
            htmlFor="create-manager-start-year"
            className="mb-1.5 block text-caption font-heading font-bold uppercase tracking-label text-fg-muted"
          >
            {t("createManager.startYear")}
          </label>
          <input
            id="create-manager-start-year"
            aria-label={t("createManager.startYear")}
            type="text"
            pattern="[0-9]*"
            inputMode="numeric"
            className={`w-full rounded-control border bg-sunken p-3 text-fg outline-none transition-all placeholder:text-fg-subtle focus:ring-2 placeholder:text-fg-muted ${
              formErrors.startYear
                ? "border-danger focus:border-danger focus-visible:ring-focus"
                : "border-line-strong focus:border-selected focus:ring-selected/20"
            }`}
            value={formData.startYear}
            onChange={(event) => {
              onChange("startYear", event.target.value);
              onClearError("startYear");
            }}
          />
          {formErrors.startYear ? (
            <p className="mt-1 flex items-center gap-1 text-caption text-danger">
              <AlertCircle className="h-3 w-3" />
              {formErrors.startYear}
            </p>
          ) : null}
        </div>

        <div className="flex-1" id="create-manager-field-startPhase">
          <label
            htmlFor="create-manager-start-phase"
            className="mb-1.5 block text-caption font-heading font-bold uppercase tracking-label text-fg-muted"
          >
            {t("createManager.startPhase")}
          </label>
          <Select
            id="create-manager-start-phase"
            aria-label={t("createManager.startPhase")}
            fullWidth
            value={formData.startPhase}
            className={
              formErrors.startPhase
                ? "border-danger focus:border-danger focus-visible:ring-focus"
                : ""
            }
            onChange={(event) => {
              onChange("startPhase", event.target.value as CareerStartPhase);
              onClearError("startPhase");
            }}
          >
            <option value="seasonStart">{t("createManager.phaseSeasonStart")}</option>
            <option value="midSeason">{t("createManager.phaseMidSeason")}</option>
          </Select>
          {formErrors.startPhase ? (
            <p className="mt-1 flex items-center gap-1 text-caption text-danger">
              <AlertCircle className="h-3 w-3" />
              {formErrors.startPhase}
            </p>
          ) : null}
        </div>
      </div>

      <Suspense fallback={<NationalityFieldFallback error={formErrors.nationality} />}>
        <CreateManagerNationalityField
          nationality={formData.nationality}
          error={formErrors.nationality}
          locale={i18n.language}
          onChange={(value) => onChange("nationality", value)}
          onClearError={() => onClearError("nationality")}
        />
      </Suspense>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="mt-2 w-full"
        iconRight={<ChevronRight />}
      >
        {t("createManager.chooseWorld")}
      </Button>
    </form>
  );
}
