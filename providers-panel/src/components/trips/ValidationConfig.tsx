import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ValidationConfig, FieldMetadata, PhoneCountry, NationalityOption } from '../../types/trip';
import { tripService } from '../../services/tripService';

interface ValidationConfigProps {
  fieldMetadata: FieldMetadata;
  currentConfig: ValidationConfig;
  onConfigChange: (config: ValidationConfig) => void;
  onValidate?: (isValid: boolean, errors: string[]) => void;
}

const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition placeholder:text-slate-400 dark:placeholder:text-slate-500";

const AgeInput: React.FC<{ vt: 'min_age'|'max_age'; paramKey: 'min_value'|'max_value'; labelKey: string; descKey: string; config: ValidationConfig; onChange:(vt:string,pk:string,v:any)=>void; onToggle:(vt:string)=>void }> = ({ vt, paramKey, labelKey, descKey, config, onChange, onToggle }) => {
  const { t } = useTranslation();
  const enabled = !!config[vt];
  const value = config[vt]?.[paramKey] ?? '';
  return (
    <div className={`rounded-xl border p-3 transition-colors ${enabled ? 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'}`}>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={enabled} onChange={() => onToggle(vt)} className="accent-sky-500" /><span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t(labelKey)}</span></label>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ms-5">{t(descKey)}</p>
      {enabled && <div className="mt-2 ms-5"><input type="number" min={0} max={120} value={value} onChange={e => onChange(vt, paramKey, parseInt(e.target.value)||0)} placeholder={t('validation.ageInYears')} className={inputCls} /></div>}
    </div>
  );
};

const PhoneCountryPicker: React.FC<{ config: ValidationConfig; onChange:(vt:string,pk:string,v:any)=>void; onToggle:(vt:string)=>void }> = ({ config, onChange, onToggle }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [countries, setCountries] = useState<PhoneCountry[]>([]);
  const [search, setSearch] = useState('');
  const enabled = !!config['phone_country_codes'];
  const selected: string[] = config['phone_country_codes']?.allowed_codes ?? [];
  useEffect(() => { tripService.getPhoneCountries().then(r => setCountries(r.countries)).catch(() => {}); }, []);
  const getCountryName = (c: PhoneCountry) => isAr && c.name_ar ? c.name_ar : c.name;
  const filtered = countries.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.name_ar.includes(search) || c.dial_code.includes(search));
  const toggle = (code: string) => { const next = selected.includes(code) ? selected.filter(x=>x!==code) : [...selected, code]; onChange('phone_country_codes','allowed_codes',next); };
  return (
    <div className={`rounded-xl border p-3 transition-colors ${enabled ? 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'}`}>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={enabled} onChange={() => onToggle('phone_country_codes')} className="accent-sky-500" /><span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('validation.phoneCountries.label')}</span></label>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ms-5">{t('validation.phoneCountries.desc')}</p>
      {enabled && (
        <div className="mt-2 ms-5 space-y-2">
          {selected.length > 0 && <div className="flex flex-wrap gap-1">{selected.map(code => { const c = countries.find(x=>x.dial_code===code); return <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-medium">{c?.flag} {c ? getCountryName(c) : ''} +{code}<button onClick={()=>toggle(code)} className="ms-1 hover:text-red-500">×</button></span>; })}</div>}
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('validation.phoneCountries.search')} className={inputCls} />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map(c => <label key={`${c.code}-${c.dial_code}`} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"><input type="checkbox" checked={selected.includes(c.dial_code)} onChange={()=>toggle(c.dial_code)} className="accent-sky-500 flex-shrink-0" /><span className="text-lg leading-none">{c.flag}</span><span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{getCountryName(c)}</span><span className="text-xs text-slate-400 dark:text-slate-500">+{c.dial_code}</span></label>)}
            {filtered.length===0 && <p className="px-3 py-2 text-xs text-slate-400">{t('validation.phoneCountries.noResults')}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const GenderPicker: React.FC<{ config: ValidationConfig; onChange:(vt:string,pk:string,v:any)=>void; onToggle:(vt:string)=>void }> = ({ config, onChange, onToggle }) => {
  const { t } = useTranslation();
  const enabled = !!config['gender_restrictions'];
  const selected: string = config['gender_restrictions']?.allowed_genders?.[0] ?? 'male';
  const pick = (v: string) => onChange('gender_restrictions', 'allowed_genders', [v]);
  return (
    <div className={`rounded-xl border p-3 transition-colors ${enabled ? 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'}`}>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={enabled} onChange={() => onToggle('gender_restrictions')} className="accent-sky-500" /><span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('validation.gender.label')}</span></label>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ms-5">{t('validation.gender.desc')}</p>
      {enabled && (
        <div className="mt-2 ms-5 flex gap-3">
          {[{value:'male',labelKey:'validation.gender.malesOnly',icon:'♂'},{value:'female',labelKey:'validation.gender.femalesOnly',icon:'♀'}].map(o => (
            <label key={o.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition ${selected === o.value ? 'border-sky-400 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-sky-300'}`}>
              <input type="radio" name="gender_restriction" checked={selected === o.value} onChange={() => pick(o.value)} className="accent-sky-500" />{o.icon} {t(o.labelKey)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};


const NationalityPicker: React.FC<{ config: ValidationConfig; onChange:(vt:string,pk:string,v:any)=>void; onToggle:(vt:string)=>void }> = ({ config, onChange, onToggle }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [nationalities, setNationalities] = useState<NationalityOption[]>([]);
  const [search, setSearch] = useState('');
  const enabled = !!config['nationality_restriction'];
  const selected: string[] = config['nationality_restriction']?.allowed_nationalities ?? [];
  useEffect(() => { tripService.getNationalities().then(r => setNationalities(r.nationalities)).catch(() => {}); }, []);
  const getNationalityName = (n: NationalityOption) => isAr ? n.name_ar : n.name;
  const filtered = nationalities.filter(n => n.name.toLowerCase().includes(search.toLowerCase()) || n.name_ar.includes(search));
  const toggle = (code: string) => { const next = selected.includes(code) ? selected.filter(c=>c!==code) : [...selected, code]; onChange('nationality_restriction','allowed_nationalities',next); };
  return (
    <div className={`rounded-xl border p-3 transition-colors ${enabled ? 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'}`}>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={enabled} onChange={() => onToggle('nationality_restriction')} className="accent-sky-500" /><span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('validation.nationality.label')}</span></label>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ms-5">{t('validation.nationality.desc')}</p>
      {enabled && (
        <div className="mt-2 ms-5 space-y-2">
          {selected.length > 0 && <div className="flex flex-wrap gap-1">{selected.map(code => { const n = nationalities.find(x=>x.code===code); return <span key={code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-medium">{n ? getNationalityName(n) : code}<button onClick={()=>toggle(code)} className="ms-1 hover:text-red-500">×</button></span>; })}</div>}
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('validation.nationality.search')} className={inputCls} />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map(n => <label key={n.code} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"><input type="checkbox" checked={selected.includes(n.code)} onChange={()=>toggle(n.code)} className="accent-sky-500 flex-shrink-0" /><span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{getNationalityName(n)}</span><span className="text-xs text-slate-400 dark:text-slate-500">{isAr ? n.name : n.name_ar}</span></label>)}
            {filtered.length===0 && <p className="px-3 py-2 text-xs text-slate-400">{t('validation.nationality.noResults')}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const ValidationConfigComponent: React.FC<ValidationConfigProps> = ({
  fieldMetadata,
  currentConfig,
  onConfigChange,
}) => {
  const { t } = useTranslation();
  const available: string[] = fieldMetadata.available_validations ?? [];

  const handleChange = useCallback((vt: string, pk: string, v: any) => {
    const next = { ...currentConfig };
    if (!next[vt]) next[vt] = {};
    next[vt][pk] = v;
    onConfigChange(next);
  }, [currentConfig, onConfigChange]);

  const handleToggle = useCallback((vt: string) => {
    const next = { ...currentConfig };
    if (next[vt]) {
      delete next[vt];
    } else {
      if (vt === 'min_age') next[vt] = { min_value: 18 };
      else if (vt === 'max_age') next[vt] = { max_value: 65 };
      else if (vt === 'phone_country_codes') next[vt] = { allowed_codes: [] };
      else if (vt === 'gender_restrictions') next[vt] = { allowed_genders: ['male'] };
      else if (vt === 'nationality_restriction') next[vt] = { allowed_nationalities: [] };
      else next[vt] = {};
    }
    onConfigChange(next);
  }, [currentConfig, onConfigChange]);

  if (available.length === 0) {
    return (
      <div className="mt-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
        <p className="text-xs italic text-slate-400 dark:text-slate-500">{t('validation.noRules')}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {t('validation.rulesForField', { field: fieldMetadata.display_name })}
      </p>
      <div className="flex flex-col gap-3">
        {available.includes('min_age') && (
          <AgeInput vt="min_age" paramKey="min_value" labelKey="validation.minAge.label" descKey="validation.minAge.desc" config={currentConfig} onChange={handleChange} onToggle={handleToggle} />
        )}
        {available.includes('max_age') && (
          <AgeInput vt="max_age" paramKey="max_value" labelKey="validation.maxAge.label" descKey="validation.maxAge.desc" config={currentConfig} onChange={handleChange} onToggle={handleToggle} />
        )}
        {available.includes('phone_country_codes') && (
          <PhoneCountryPicker config={currentConfig} onChange={handleChange} onToggle={handleToggle} />
        )}
        {available.includes('gender_restrictions') && (
          <GenderPicker config={currentConfig} onChange={handleChange} onToggle={handleToggle} />
        )}
        {available.includes('nationality_restriction') && (
          <NationalityPicker config={currentConfig} onChange={handleChange} onToggle={handleToggle} />
        )}
      </div>
    </div>
  );
};

export default ValidationConfigComponent;
