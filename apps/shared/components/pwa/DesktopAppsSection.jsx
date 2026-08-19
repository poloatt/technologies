import React from 'react';
import {
  Box,
  Button,
  Grid,
  Link,
  Paper,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { GetApp as GetAppIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import currentConfig from '../../config/envConfig';
import { getPwaAppMeta } from '../../config/pwaConfig';
import { bottomNavigationItems } from '../../navigation/menuStructure';
import { getIconByKey } from '../../navigation/menuIcons';
import { useAppConfig } from '../../hooks/useAppDetection';
import usePwaInstall from '../../hooks/usePwaInstall';
import { getCurrentAppKey } from '../../utils/navigationUtils';

function SisterAppCard({ appKey, title, iconKey, url, isCurrent }) {
  const IconComponent = getIconByKey(iconKey);
  const meta = getPwaAppMeta(appKey);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: '100%',
        border: '1px solid',
        borderColor: isCurrent ? meta.themeColor || 'primary.main' : 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        {IconComponent && (
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: '#181818',
              border: '2px solid',
              borderColor: meta.themeColor || 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.createElement(IconComponent, { sx: { fontSize: 20, color: 'white' } })}
          </Box>
        )}
        <Box>
          <Typography variant="subtitle1">{title}</Typography>
          {isCurrent && (
            <Typography variant="caption" color="text.secondary">
              App actual
            </Typography>
          )}
        </Box>
      </Box>
      <Button
        component={Link}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        size="small"
        endIcon={<OpenInNewIcon />}
        variant={isCurrent ? 'contained' : 'outlined'}
        fullWidth
      >
        {isCurrent ? 'Abrir en navegador' : 'Instalar desde aquí'}
      </Button>
    </Paper>
  );
}

export default function DesktopAppsSection() {
  const { appTitle } = useAppConfig();
  const currentAppKey = getCurrentAppKey();
  const { canInstall, promptInstall, installError } = usePwaInstall();

  const apps = bottomNavigationItems.filter((item) => item.appKey);

  return (
    <Paper elevation={0} sx={{ p: 3, mt: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'left' }}>
      <Typography variant="h6" gutterBottom>
        Apps de escritorio
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Instala Foco, Caja y Pulso por separado — como Google Workspace — para usar varias apps a la vez
        desde la barra de tareas.
      </Typography>

      <Stepper orientation="vertical" nonLinear sx={{ mb: 3 }}>
        <Step active expanded>
          <StepLabel>Instalar {appTitle}</StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              En Chrome o Edge, usa el botón de instalar o el menú del navegador →
              &quot;Instalar {appTitle}&quot;.
            </Typography>
            {canInstall ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<GetAppIcon />}
                onClick={promptInstall}
                sx={{ mb: 1 }}
              >
                Instalar {appTitle}
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Si no ves el botón, abre el menú ⋮ del navegador y elige &quot;Instalar app&quot;.
              </Typography>
            )}
            {installError && (
              <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                {installError}
              </Typography>
            )}
          </StepContent>
        </Step>
        <Step active expanded>
          <StepLabel>Instalar las otras apps</StepLabel>
          <StepContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {apps.map((item) => (
                <Grid item xs={12} sm={4} key={item.appKey}>
                  <SisterAppCard
                    appKey={item.appKey}
                    title={item.title}
                    iconKey={item.icon}
                    url={currentConfig.frontendUrls[item.appKey]}
                    isCurrent={item.appKey === currentAppKey}
                  />
                </Grid>
              ))}
            </Grid>
          </StepContent>
        </Step>
        <Step active expanded>
          <StepLabel>Multitarea</StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary">
              Abre cada app desde su icono en la barra de tareas y alterna con Alt+Tab.
              El menú de 9 puntos (⋮⋮⋮) sirve para cambio rápido dentro de una sola ventana.
            </Typography>
          </StepContent>
        </Step>
      </Stepper>
    </Paper>
  );
}
