import { useEffect, useState } from "react";
import { ActiveBadge } from "../components/Badge";
import { LocationFormDialog } from "../components/LocationFormDialog";
import { ErrorState, LoadingState } from "../components/States";
import {
  createCity,
  createCountry,
  createState,
  deactivateCity,
  deactivateCountry,
  deactivateState,
  listAdminCities,
  listAdminCountries,
  listAdminStates,
  updateCity,
  updateCountry,
  updateState,
} from "../lib/locations";
import type { CitySummary, CountrySummary, StateSummary } from "../lib/types";

type Dialog =
  | { kind: "create-country" }
  | { kind: "edit-country"; country: CountrySummary }
  | { kind: "create-state"; countryId: string }
  | { kind: "edit-state"; state: StateSummary }
  | { kind: "create-city"; stateId: string }
  | { kind: "edit-city"; city: CitySummary }
  | null;

/** Forces the relevant `LocationFormDialog` to remount per target instead of resetting fields via an effect — see the matching helper in CategoriesPage.tsx. */
function dialogKey(dialog: Dialog): string {
  if (!dialog) return "closed";
  if (dialog.kind === "edit-country") return `edit-country-${dialog.country.id}`;
  if (dialog.kind === "create-state") return `create-state-${dialog.countryId}`;
  if (dialog.kind === "edit-state") return `edit-state-${dialog.state.id}`;
  if (dialog.kind === "create-city") return `create-city-${dialog.stateId}`;
  if (dialog.kind === "edit-city") return `edit-city-${dialog.city.id}`;
  return dialog.kind;
}

export function LocationsPage() {
  const [countries, setCountries] = useState<CountrySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  // Bumped after any state/city save so the (separately-fetched) nested
  // lists below refetch — see the matching `refreshToken` prop on
  // StateList/CityList.
  const [refreshToken, setRefreshToken] = useState(0);

  // See the matching comment in CategoriesPage.tsx: no synchronous reset
  // before the fetch, only `.then`/`.catch`.
  function load() {
    listAdminCountries({ limit: 100 })
      .then((r) => setCountries(r.items))
      .catch(() => setError("Could not load countries."));
  }

  useEffect(load, []);

  async function toggleCountryActive(country: CountrySummary) {
    if (country.isActive) await deactivateCountry(country.id);
    else await updateCountry(country.id, { isActive: true });
    load();
  }

  if (error) return <ErrorState message={error} />;
  if (!countries) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Locations</h1>
        <button
          type="button"
          onClick={() => setDialog({ kind: "create-country" })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New country
        </button>
      </div>

      <div className="space-y-3">
        {countries.map((country) => (
          <div key={country.id} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-slate-900">
                  {country.name} <span className="text-xs text-slate-400">({country.code})</span>
                </p>
                <p className="text-xs text-slate-500">/{country.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <ActiveBadge isActive={country.isActive ?? true} />
                <button
                  type="button"
                  onClick={() => setExpandedCountry(expandedCountry === country.id ? null : country.id)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {expandedCountry === country.id ? "Hide states" : "States"}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "edit-country", country })}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleCountryActive(country)}
                  className="text-sm text-slate-600 hover:underline"
                >
                  {country.isActive ?? true ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
            {expandedCountry === country.id ? (
              <StateList
                countryId={country.id}
                refreshToken={refreshToken}
                onEditState={(state) => setDialog({ kind: "edit-state", state })}
                onCreateState={() => setDialog({ kind: "create-state", countryId: country.id })}
                onEditCity={(city) => setDialog({ kind: "edit-city", city })}
                onCreateCity={(stateId) => setDialog({ kind: "create-city", stateId })}
              />
            ) : null}
          </div>
        ))}
      </div>

      <LocationFormDialog
        key={dialogKey(dialog?.kind === "create-country" || dialog?.kind === "edit-country" ? dialog : null)}
        open={dialog?.kind === "create-country" || dialog?.kind === "edit-country"}
        title={dialog?.kind === "edit-country" ? "Edit country" : "New country"}
        showCode
        codeRequired
        initial={dialog?.kind === "edit-country" ? dialog.country : undefined}
        onSave={async (values) => {
          if (dialog?.kind === "edit-country") await updateCountry(dialog.country.id, values as { name: string; code?: string; sortOrder: number });
          else await createCountry(values as { name: string; code: string; sortOrder: number });
          load();
        }}
        onClose={() => setDialog(null)}
      />

      <LocationFormDialog
        key={dialogKey(dialog?.kind === "create-state" || dialog?.kind === "edit-state" ? dialog : null)}
        open={dialog?.kind === "create-state" || dialog?.kind === "edit-state"}
        title={dialog?.kind === "edit-state" ? "Edit state" : "New state"}
        showCode
        initial={dialog?.kind === "edit-state" ? dialog.state : undefined}
        onSave={async (values) => {
          if (dialog?.kind === "edit-state") await updateState(dialog.state.id, values);
          else if (dialog?.kind === "create-state") await createState(dialog.countryId, values as { name: string });
          setRefreshToken((t) => t + 1);
        }}
        onClose={() => setDialog(null)}
      />

      <LocationFormDialog
        key={dialogKey(dialog?.kind === "create-city" || dialog?.kind === "edit-city" ? dialog : null)}
        open={dialog?.kind === "create-city" || dialog?.kind === "edit-city"}
        title={dialog?.kind === "edit-city" ? "Edit city" : "New city"}
        showCode={false}
        initial={dialog?.kind === "edit-city" ? dialog.city : undefined}
        onSave={async (values) => {
          if (dialog?.kind === "edit-city") await updateCity(dialog.city.id, values);
          else if (dialog?.kind === "create-city") await createCity(dialog.stateId, values as { name: string });
          setRefreshToken((t) => t + 1);
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function StateList({
  countryId,
  refreshToken,
  onEditState,
  onCreateState,
  onEditCity,
  onCreateCity,
}: {
  countryId: string;
  refreshToken: number;
  onEditState: (state: StateSummary) => void;
  onCreateState: () => void;
  onEditCity: (city: CitySummary) => void;
  onCreateCity: (stateId: string) => void;
}) {
  const [states, setStates] = useState<StateSummary[] | null>(null);
  const [expandedState, setExpandedState] = useState<string | null>(null);

  function load() {
    listAdminStates(countryId, { limit: 100 })
      .then((r) => setStates(r.items))
      .catch(() => setStates([]));
  }

  // Refetches whenever a state or city is saved anywhere on this page (see
  // `refreshToken` in LocationsPage) — simple and correct at this phase's
  // scale, if not the most surgical possible invalidation.
  useEffect(load, [countryId, refreshToken]);

  async function toggleActive(state: StateSummary) {
    if (state.isActive) await deactivateState(state.id);
    else await updateState(state.id, { isActive: true });
    load();
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-slate-500">States</p>
        <button type="button" onClick={onCreateState} className="text-sm text-blue-600 hover:underline">
          Add state
        </button>
      </div>
      {states === null ? (
        <LoadingState />
      ) : states.length === 0 ? (
        <p className="text-sm text-slate-400">No states yet.</p>
      ) : (
        <ul className="space-y-2">
          {states.map((state) => (
            <li key={state.id} className="rounded-md bg-white">
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{state.name}</span>
                <span className="flex items-center gap-3">
                  <ActiveBadge isActive={state.isActive ?? true} />
                  <button
                    type="button"
                    onClick={() => setExpandedState(expandedState === state.id ? null : state.id)}
                    className="text-blue-600 hover:underline"
                  >
                    {expandedState === state.id ? "Hide cities" : "Cities"}
                  </button>
                  <button type="button" onClick={() => onEditState(state)} className="text-blue-600 hover:underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => toggleActive(state)} className="text-slate-600 hover:underline">
                    {state.isActive ?? true ? "Deactivate" : "Activate"}
                  </button>
                </span>
              </div>
              {expandedState === state.id ? (
                <CityList
                  stateId={state.id}
                  refreshToken={refreshToken}
                  onEdit={onEditCity}
                  onCreate={() => onCreateCity(state.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CityList({
  stateId,
  refreshToken,
  onEdit,
  onCreate,
}: {
  stateId: string;
  refreshToken: number;
  onEdit: (city: CitySummary) => void;
  onCreate: () => void;
}) {
  const [cities, setCities] = useState<CitySummary[] | null>(null);

  function load() {
    listAdminCities(stateId, { limit: 100 })
      .then((r) => setCities(r.items))
      .catch(() => setCities([]));
  }

  useEffect(load, [stateId, refreshToken]);

  async function toggleActive(city: CitySummary) {
    if (city.isActive) await deactivateCity(city.id);
    else await updateCity(city.id, { isActive: true });
    load();
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-slate-500">Cities</p>
        <button type="button" onClick={onCreate} className="text-sm text-blue-600 hover:underline">
          Add city
        </button>
      </div>
      {cities === null ? (
        <LoadingState />
      ) : cities.length === 0 ? (
        <p className="text-sm text-slate-400">No cities yet.</p>
      ) : (
        <ul className="space-y-2">
          {cities.map((city) => (
            <li key={city.id} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
              <span>{city.name}</span>
              <span className="flex items-center gap-3">
                <ActiveBadge isActive={city.isActive ?? true} />
                <button type="button" onClick={() => onEdit(city)} className="text-blue-600 hover:underline">
                  Edit
                </button>
                <button type="button" onClick={() => toggleActive(city)} className="text-slate-600 hover:underline">
                  {city.isActive ?? true ? "Deactivate" : "Activate"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
