import React from 'react';
import { useNavigationBar } from '../context/NavigationBarContext';
import { styled } from '@mui/material/styles';
import { AppBar, Toolbar, Typography, Box, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { 
  TrendingUpOutlined as AssetsIcon,
  FitnessCenterOutlined as RutinasIcon,
  TaskOutlined as TareasIcon,
  AccountBalanceWalletOutlined as WalletIcon,
  CalendarMonthOutlined as CalendarIcon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { navigateToAppPath, prefetchAppForPath } from '../utils/navigationUtils';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#000000',
  boxShadow: 'none',
  borderBottom: `1px solid ${theme.palette.divider}`,
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  transform: 'translateY(0)',
  transition: 'transform 0.3s ease-in-out',
  '&.hidden': {
    transform: 'translateY(-100%)',
  },
}));

const StyledToolbar = styled(Toolbar)({
  minHeight: '48px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 16px',
});

const MinimalNavigationBar = () => {
  const { isVisible, title, actions } = useNavigationBar();

  if (!isVisible) return null;

  return (
    <StyledAppBar className={!isVisible ? 'hidden' : ''}>
      <StyledToolbar>
        <Typography variant="subtitle1" component="div" sx={{ color: 'white' }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {actions.map((action, index) => (
            <Box key={index} onClick={action.onClick} sx={{ cursor: 'pointer' }}>
              {action.component}
            </Box>
          ))}
        </Box>
      </StyledToolbar>
    </StyledAppBar>
  );
};

export const FooterNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { path: '/finanzas', icon: <WalletIcon />, label: 'Assets' },
    { path: '/data', icon: <CalendarIcon />, label: 'Salud' },
    { path: '/rutinas', icon: <TareasIcon />, label: 'Tiempo' }
  ];

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderRadius: 0,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        zIndex: 1000,
        filter: 'brightness(1.15)',
        '& .MuiBottomNavigation-root': {
          bgcolor: 'transparent'
        }
      }}
      elevation={0}
    >
      <BottomNavigation
        showLabels={false}
        value={navigationItems.findIndex(item => item.path === location.pathname)}
        sx={{
          bgcolor: 'transparent',
          height: 83,
          '& .MuiBottomNavigationAction-root': {
            padding: 1.75,
            minWidth: 'auto',
            '&.Mui-selected': {
              '& .MuiSvgIcon-root': {
                transform: 'scale(1.2)',
                color: 'primary.main',
                filter: 'brightness(1.15)',
                transition: 'all 0.2s ease'
              }
            }
          }
        }}
      >
        {navigationItems.map((item, index) => (
          <BottomNavigationAction
            key={item.path}
            icon={item.icon}
            onClick={() => navigateToAppPath(navigate, item.path)}
            onMouseEnter={() => prefetchAppForPath(item.path)}
            onFocus={() => prefetchAppForPath(item.path)}
            sx={{
              minWidth: 'auto',
              padding: 1.15,
              '& .MuiSvgIcon-root': {
                fontSize: '2rem',
                transition: 'all 0.2s ease',
                color: location.pathname === item.path ? 'primary.main' : 'text.secondary',
                opacity: location.pathname === item.path ? 1 : 0.85,
                filter: location.pathname === item.path ? 'brightness(1.15)' : 'brightness(1.05)'
              },
              '&:hover': {
                '& .MuiSvgIcon-root': {
                  color: 'primary.main',
                  transform: 'scale(1.15)',
                  opacity: 1,
                  filter: 'brightness(1.15)'
                }
              }
            }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default MinimalNavigationBar;
